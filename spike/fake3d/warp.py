"""Depth-based forward warp for the fake-3D rotation spike.

Pure NumPy, CPU-only. Given a source image + depth map + a target camera
rotation, this produces the "broken" reprojection (the geometric proxy) that the
diffusion re-styler in ``restyle.py`` then repairs. Disoccluded regions show up
as holes in ``hole_mask`` — exactly the regions a generative model must
hallucinate (see docs/03).
"""

from __future__ import annotations

import numpy as np

from .camera import orbit_rotation, reproject


def forward_warp(
    image: np.ndarray,
    depth: np.ndarray,
    yaw_deg: float,
    pitch_deg: float = 0.0,
    dolly: float = 0.0,
    K: np.ndarray | None = None,
    pivot_depth: float | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Warp ``image`` to a new camera pose using ``depth``.

    Args:
        image: ``(H, W, 3)`` uint8 or float array.
        depth: ``(H, W)`` positive depth (relative is fine; larger = farther).
        yaw_deg / pitch_deg: camera orbit angles.
        dolly: forward/back translation in scene units.
        K: 3x3 intrinsics; defaults to a 55-deg-FOV pinhole for the image size.
        pivot_depth: orbit pivot distance; defaults to the median depth.

    Returns:
        ``(warped, hole_mask)`` where ``warped`` matches ``image`` dtype/shape
        and ``hole_mask`` is ``(H, W)`` uint8 (255 = hole to inpaint).
    """
    from .camera import intrinsics_from_fov

    H, W = depth.shape[:2]
    if K is None:
        K = intrinsics_from_fov(W, H)
    if pivot_depth is None:
        pivot_depth = float(np.median(depth))

    vv, uu = np.meshgrid(np.arange(H), np.arange(W), indexing="ij")
    u = uu.ravel().astype(np.float64)
    v = vv.ravel().astype(np.float64)
    z = depth.ravel().astype(np.float64)

    R = orbit_rotation(yaw_deg, pitch_deg)
    uv, zp = reproject(u, v, z, K, R, pivot_depth, dolly)

    tu = np.round(uv[:, 0]).astype(np.int64)
    tv = np.round(uv[:, 1]).astype(np.int64)

    in_bounds = (tu >= 0) & (tu < W) & (tv >= 0) & (tv < H) & (zp > 0)

    src_idx = np.nonzero(in_bounds)[0]
    tu, tv, zp = tu[in_bounds], tv[in_bounds], zp[in_bounds]

    # z-buffer: draw far pixels first so nearer ones overwrite them.
    order = np.argsort(-zp)
    src_idx, tu, tv = src_idx[order], tu[order], tv[order]

    warped = np.zeros_like(image)
    filled = np.zeros((H, W), dtype=bool)

    flat_img = image.reshape(-1, image.shape[-1]) if image.ndim == 3 else image.reshape(-1, 1)
    warped_flat = warped.reshape(-1, warped.shape[-1]) if warped.ndim == 3 else warped.reshape(-1, 1)

    target_flat = tv * W + tu
    warped_flat[target_flat] = flat_img[src_idx]
    filled.reshape(-1)[target_flat] = True

    hole_mask = np.where(filled, 0, 255).astype(np.uint8)
    return warped, hole_mask
