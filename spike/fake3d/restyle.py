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
SDXL_BASE = "stabilityai/stable-diffusion-xl-base-1.0"          # verify per use
CONTROLNET_DEPTH = "diffusers/controlnet-depth-sdxl-1.0"        # depth conditioning
CONTROLNET_LINEART = "kataragi/ControlNet-LineartXL"            # anime line-art

DEFAULT_PROMPT = (
    "manga background, clean black line art, screentone-ready, detailed "
    "perspective, ink lineart, monochrome"
)
DEFAULT_NEGATIVE = "color, photo, blurry, lowres, watermark, text"

_pipe = None


def _get_pipe():
    global _pipe
    if _pipe is None:
        import torch
        from diffusers import (
            ControlNetModel,
            StableDiffusionXLControlNetInpaintPipeline,
        )

        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        controlnets = [
            ControlNetModel.from_pretrained(CONTROLNET_DEPTH, torch_dtype=dtype),
            ControlNetModel.from_pretrained(CONTROLNET_LINEART, torch_dtype=dtype),
        ]
        pipe = StableDiffusionXLControlNetInpaintPipeline.from_pretrained(
            SDXL_BASE, controlnet=controlnets, torch_dtype=dtype
        )
        if torch.cuda.is_available():
            pipe = pipe.to("cuda")
            pipe.enable_xformers_memory_efficient_attention()
        _pipe = pipe
    return _pipe


def restyle_to_lineart(
    warped_rgb: np.ndarray,
    hole_mask: np.ndarray,
    depth_control: Image.Image,
    lineart_control: Image.Image,
    prompt: str = DEFAULT_PROMPT,
    seed: int = 12345,
    denoise: float = 0.55,
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

    init = Image.fromarray(warped_rgb)
    mask = Image.fromarray(hole_mask)

    result = pipe(
        prompt=prompt,
        negative_prompt=DEFAULT_NEGATIVE,
        image=init,
        mask_image=mask,
        control_image=[depth_control, lineart_control],
        controlnet_conditioning_scale=[depth_scale, lineart_scale],
        strength=denoise,
        num_inference_steps=30,
        generator=generator,
    ).images[0]
    return result
