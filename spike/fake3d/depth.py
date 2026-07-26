"""Monocular depth estimation (GPU).

Wraps Depth Anything V2 *Small* — the only V2 size under Apache-2.0, hence the
only one usable commercially (Base/Large/Giant are CC-BY-NC; see docs/03). Swap
``MODEL_ID`` for a Marigold checkpoint if you prefer diffusion depth.

Requires: torch, transformers, pillow. Runs on CUDA if available.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

# Apache-2.0, commercial OK (docs/03).
MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"

_pipe = None


def _get_pipe():
    global _pipe
    if _pipe is None:
        import torch
        from transformers import pipeline

        device = 0 if torch.cuda.is_available() else -1
        _pipe = pipeline("depth-estimation", model=MODEL_ID, device=device)
    return _pipe


def estimate_depth(image: Image.Image) -> np.ndarray:
    """Return a positive float depth map ``(H, W)`` where larger = farther.

    Depth Anything outputs *inverse* depth (near = large), so we invert it to a
    metric-agnostic "distance" that the warp expects (far = large).
    """
    pipe = _get_pipe()
    out = pipe(image)["predicted_depth"]  # torch tensor, near = large

    disparity = out.squeeze().detach().cpu().numpy().astype(np.float64)
    # Normalize disparity to (0, 1], then invert to a depth-like quantity.
    d = disparity - disparity.min()
    d = d / (d.max() + 1e-8)
    # Compress the near/far ratio: a large range exaggerates parallax and melts
    # the warp. Default ~3x (indoor-ish). Raise FONDO_DEPTH_RANGE for scenes with
    # real depth (streets, landscapes), lower it if the warp still distorts.
    import os

    ratio = max(1.2, float(os.environ.get("FONDO_DEPTH_RANGE", "3.0")))
    lo = 1.0 / ratio
    depth = 1.0 / (d * (1.0 - lo) + lo)  # near(d=1)->1.0, far(d=0)->ratio

    # Resize to the image resolution if the model worked at a different size.
    H, W = image.height, image.width
    if depth.shape != (H, W):
        depth = np.asarray(
            Image.fromarray(depth.astype(np.float32)).resize((W, H), Image.BILINEAR),
            dtype=np.float64,
        )
    return depth
