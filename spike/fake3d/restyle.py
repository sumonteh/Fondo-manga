"""Line-art re-generation of the warped proxy (GPU).

Takes the "broken" reprojection + its hole mask and re-draws a clean line-art
frame at the new camera angle, conditioned on:
  * ControlNet-Depth  -> locks the new-camera perspective
  * ControlNet-Lineart-anime -> locks the manga line-art style
  * the source image  -> ip-adapter / reference for style coherence
  * a fixed seed      -> cross-view consistency

This is the piece that "hallucinates" the disoccluded holes (docs/03). All
model IDs below are open weights; verify each checkpoint's license before
shipping commercially (the base SDXL anime checkpoint is the main one to check).

Requires: torch, diffusers, transformers, controlnet-aux. Needs ~12-16 GB VRAM.
This module is intentionally a thin, honest scaffold: the exact ControlNet
scales, denoise strength and prompt are what the spike is meant to tune.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

# --- Model choices (open weights; confirm commercial license per checkpoint) ---
# All three are overridable via env vars so you can swap a checkpoint without
# editing code (e.g. if a ControlNet ships as a single file, not diffusers fmt).
import os

SDXL_BASE = os.environ.get("FONDO_SDXL_BASE", "stabilityai/stable-diffusion-xl-base-1.0")
CONTROLNET_DEPTH = os.environ.get("FONDO_CN_DEPTH", "diffusers/controlnet-depth-sdxl-1.0")
# Official diffusers-format edge ControlNet: guaranteed to load, permissive
# license, and works with our line-art hint as an edge map. For stronger anime
# line fidelity, override with FONDO_CN_LINEART=r3gm/controlnet-lineart-anime-sdxl-fp16.
CONTROLNET_LINEART = os.environ.get("FONDO_CN_LINEART", "diffusers/controlnet-canny-sdxl-1.0")

DEFAULT_PROMPT = (
    "manga background, clean black line art, screentone-ready, detailed "
    "perspective, ink lineart, monochrome"
)
DEFAULT_NEGATIVE = "color, photo, blurry, lowres, watermark, text"

# Line-art ControlNet hint: white lines on black, matching controlnet-aux's
# LineartAnimeDetector output convention. Flip ``invert`` if your checkpoint
# expects black-on-white.
_lineart_detector = None


def _gaussian_blur(gray: np.ndarray, sigma: float) -> np.ndarray:
    """Tiny separable Gaussian blur (NumPy only, no SciPy)."""
    if sigma <= 0:
        return gray
    radius = max(1, int(round(3 * sigma)))
    x = np.arange(-radius, radius + 1)
    k = np.exp(-(x**2) / (2 * sigma**2))
    k /= k.sum()
    pad = np.pad(gray, ((0, 0), (radius, radius)), mode="edge")
    horiz = np.stack([pad[:, i : i + gray.shape[1]] for i in range(len(k))], 0)
    blurred = np.tensordot(k, horiz, axes=(0, 0))
    pad = np.pad(blurred, ((radius, radius), (0, 0)), mode="edge")
    vert = np.stack([pad[i : i + gray.shape[0], :] for i in range(len(k))], 0)
    return np.tensordot(k, vert, axes=(0, 0))


def _cpu_lineart(image: Image.Image, sigma: float, thresh: float, invert: bool) -> Image.Image:
    """CPU fallback line extractor via Difference-of-Gaussians edges.

    Not a learned detector — just enough to run the pipeline end-to-end on CPU
    (``rotate.py --dry-run``) and to eyeball the hint. On the GPU the real
    ``LineartAnimeDetector`` is used instead.
    """
    gray = np.asarray(image.convert("L"), dtype=np.float64) / 255.0
    dog = _gaussian_blur(gray, sigma) - _gaussian_blur(gray, sigma * 2.2)
    mag = np.abs(dog)
    mag /= mag.max() + 1e-8
    lines = (mag > thresh).astype(np.uint8) * 255  # white lines on black
    if invert:
        lines = 255 - lines
    return Image.fromarray(lines).convert("RGB")


def lineart_preprocess(
    image: Image.Image,
    method: str = "anime",
    sigma: float = 1.2,
    thresh: float = 0.09,
    invert: bool = False,
) -> Image.Image:
    """Produce the line-art ControlNet hint from an RGB image.

    Uses ``controlnet_aux.LineartAnimeDetector`` (or ``LineartDetector`` for
    ``method="realistic"``) when torch is available; otherwise falls back to a
    NumPy DoG edge map so the pipeline still runs on CPU.

    Args:
        method: ``"anime"`` (manga line art) or ``"realistic"``.
        sigma/thresh: CPU-fallback edge sensitivity.
        invert: flip polarity to black-on-white if the checkpoint expects it.
    """
    global _lineart_detector
    try:
        import torch  # noqa: F401
        from controlnet_aux import LineartAnimeDetector, LineartDetector
    except Exception:
        return _cpu_lineart(image, sigma, thresh, invert)

    if _lineart_detector is None:
        cls = LineartAnimeDetector if method == "anime" else LineartDetector
        _lineart_detector = cls.from_pretrained("lllyasviel/Annotators")
    hint = _lineart_detector(image)
    if invert:
        hint = Image.fromarray(255 - np.asarray(hint.convert("L"))).convert("RGB")
    return hint.convert("RGB")


_pipe = None


def _load_controlnet(ref, dtype):
    """Load a ControlNet from a diffusers-format repo or a single-file checkpoint."""
    from diffusers import ControlNetModel

    try:
        return ControlNetModel.from_pretrained(ref, torch_dtype=dtype)
    except Exception as e_repo:
        # Some checkpoints ship as a single .safetensors, not diffusers format.
        try:
            return ControlNetModel.from_single_file(ref, torch_dtype=dtype)
        except Exception as e_file:
            raise RuntimeError(
                f"Could not load ControlNet '{ref}' as diffusers repo "
                f"({e_repo}) nor as single file ({e_file}). Override it with an "
                f"env var (FONDO_CN_DEPTH / FONDO_CN_LINEART) pointing at a "
                f"diffusers-format SDXL ControlNet."
            ) from e_file


def _sdxl_size(w: int, h: int, target: int = 1024, mult: int = 64) -> tuple[int, int]:
    """Nearest SDXL-friendly (W, H): long side ~target, both multiples of ``mult``."""
    scale = target / max(w, h)
    W = max(mult, int(round(w * scale / mult)) * mult)
    H = max(mult, int(round(h * scale / mult)) * mult)
    return W, H


def _get_pipe():
    global _pipe
    if _pipe is None:
        import torch
        from diffusers import StableDiffusionXLControlNetImg2ImgPipeline

        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        controlnets = [
            _load_controlnet(CONTROLNET_DEPTH, dtype),
            _load_controlnet(CONTROLNET_LINEART, dtype),
        ]
        # img2img (not inpaint): re-render the WHOLE warped frame in line-art,
        # guided by depth+lineart ControlNets — inpaint-only-holes left the
        # visible warp as a raw photo instead of restyling it.
        pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(
            SDXL_BASE, controlnet=controlnets, torch_dtype=dtype
        )
        if torch.cuda.is_available():
            # 32 GB (RTX 5090) fits comfortably; set FONDO_LOWVRAM=1 on <=16 GB
            # cards (e.g. RTX 5080) to offload submodules to CPU instead.
            if os.environ.get("FONDO_LOWVRAM") == "1":
                pipe.enable_model_cpu_offload()
            else:
                pipe = pipe.to("cuda")
            # xformers is optional; torch SDPA already gives efficient attention.
            try:
                pipe.enable_xformers_memory_efficient_attention()
            except Exception:
                pass
        _pipe = pipe
    return _pipe


def restyle_to_lineart(
    warped_rgb: np.ndarray,
    hole_mask: np.ndarray,
    depth_control: Image.Image,
    lineart_control: Image.Image,
    prompt: str = DEFAULT_PROMPT,
    seed: int = 12345,
    denoise: float = 0.8,
    depth_scale: float = 0.75,
    lineart_scale: float = 0.9,
) -> Image.Image:
    """Re-generate a coherent line-art frame from the warped proxy.

    Args:
        warped_rgb: ``(H, W, 3)`` uint8 forward-warp output.
        hole_mask: ``(H, W)`` uint8, 255 where disoccluded (inpaint target).
        depth_control: depth map of the *new* camera as a PIL image.
        lineart_control: line-art hint (e.g. lineart of the warped proxy).
        denoise/scales: the knobs the spike sweeps to trade fidelity vs. cleanup.
    """
    import torch

    pipe = _get_pipe()
    generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu")
    generator = generator.manual_seed(seed)

    # SDXL needs a friendly resolution (multiples of 64, ~1024 on the long side)
    # and all conditioning images at the SAME size as the latent, otherwise the
    # ControlNet cond and the latent mismatch (RuntimeError on tensor sizes).
    # ``hole_mask`` is unused here: img2img re-renders the whole frame (holes
    # get drawn as part of the full generation, guided by the ControlNets).
    src_w, src_h = Image.fromarray(warped_rgb).size
    W, H = _sdxl_size(src_w, src_h)

    init = Image.fromarray(warped_rgb).resize((W, H), Image.BILINEAR)
    depth_control = depth_control.resize((W, H), Image.BILINEAR)
    lineart_control = lineart_control.resize((W, H), Image.BILINEAR)

    result = pipe(
        prompt=prompt,
        negative_prompt=DEFAULT_NEGATIVE,
        image=init,
        control_image=[depth_control, lineart_control],
        controlnet_conditioning_scale=[depth_scale, lineart_scale],
        strength=denoise,
        num_inference_steps=30,
        generator=generator,
    ).images[0]
    # Return at the original working resolution so downstream stays consistent.
    return result.resize((src_w, src_h), Image.BILINEAR)
