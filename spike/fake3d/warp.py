"""Depth-based forward warp for the fake-3D rotation spike.

Pure NumPy, CPU-only. Given a source image + depth map + a target camera
rotation, this produces the "broken" reprojection (the geometric proxy) that the
diffusion re-styler in ``restyle.py`` then repairs.

A naive single-pixel forward splat leaves two very different kinds of gaps:

  * **resampling gaps** — 1-2 px holes that open up simply because the surface
    stretches under the new camera (same surface, no new geometry revealed), and
  * **disocclusion holes** — genuinely new regions the source never saw.

Only the second kind should be handed to the generative model to hallucinate
(docs/03). So after the z-buffered splat we run ``_fill_small_gaps``: a few
passes of z-guided nearest-neighbour fill that close resampling gaps from the
*foreground* surface while leaving the wide disocclusion holes open. This makes
``hole_ratio`` a meaningful proxy for "how much must be hallucinated".
"""

from __future__ import annotations

import numpy as np

from .camera import intrinsics_from_fov, orbit_rotation, reproject

_NEIGHBORS = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]


def _shift(a: np.ndarray, dy: int, dx: int, fill):
    """Shift array by (dy, dx) padding the exposed border with ``fill``."""
    out = np.full_like(a, fill)
    ys_src = slice(max(0, -dy), a.shape[0] - max(0, dy))
    xs_src = slice(max(0, -dx), a.shape[1] - max(0, dx))
    ys_dst = slice(max(0, dy), a.shape[0] - max(0, -dy))
    xs_dst = slice(max(0, dx), a.shape[1] - max(0, -dx))
    out[ys_dst, xs_dst] = a[ys_src, xs_src]
    return out


def _fill_small_gaps(warped, filled, zbuf, passes: int):
    """Close resampling gaps from the nearest-depth (foreground) neighbour.

    Runs a bounded number of passes so that thin gaps get filled but wide
    disocclusion holes stay open. Operates in place and returns ``filled``.
    """
    for _ in range(passes):
        holes = ~filled
        if not holes.any():
            break
        best_z = np.full(filled.shape, np.inf)
        best_col = np.zeros_like(warped)
        for dy, dx in _NEIGHBORS:
            nb_filled = _shift(filled, dy, dx, False)
            nb_z = _shift(zbuf, dy, dx, np.inf)
            nb_col = _shift(warped, dy, dx, 0)
            better = holes & nb_filled & (nb_z < best_z)
            best_z = np.where(better, nb_z, best_z)
            best_col = np.where(better[..., None], nb_col, best_col)
        newly = holes & np.isfinite(best_z)
        if not newly.any():
            break
        warped[newly] = best_col[newly]
        zbuf[newly] = best_z[newly]
        filled = filled | newly
    return filled


def forward_warp(
    image: np.ndarray,
    depth: np.ndarray,
    yaw_deg: float,
    pitch_deg: float = 0.0,
    dolly: float = 0.0,
    K: np.ndarray | None = None,
    pivot_depth: float | None = None,
    fill_passes: int = 3,
) -> tuple[np.ndarray, np.ndarray]:
    """Warp ``image`` to a new camera pose using ``depth``.

    Args:
        image: ``(H, W, 3)`` uint8 or float array.
        depth: ``(H, W)`` positive depth (relative is fine; larger = farther).
        yaw_deg / pitch_deg: camera orbit angles.
        dolly: forward/back translation in scene units.
        K: 3x3 intrinsics; defaults to a 55-deg-FOV pinhole for the image size.
        pivot_depth: orbit pivot distance; defaults to the median depth.
        fill_passes: z-guided gap-fill passes (0 = raw single-pixel splat).

    Returns:
        ``(warped, hole_mask)`` where ``warped`` matches ``image`` dtype/shape
        and ``hole_mask`` is ``(H, W)`` uint8 (255 = hole to inpaint).
    """
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

    # z-buffer: draw far pixels first so the nearest one is written last and wins.
    order = np.argsort(-zp)
    src_idx, tu, tv, zp = src_idx[order], tu[order], tv[order], zp[order]

    warped = np.zeros_like(image)
    filled = np.zeros((H, W), dtype=bool)
    zbuf = np.full((H, W), np.inf)

    flat_img = image.reshape(-1, image.shape[-1]) if image.ndim == 3 else image.reshape(-1, 1)
    warped_flat = warped.reshape(-1, warped.shape[-1]) if warped.ndim == 3 else warped.reshape(-1, 1)

    target_flat = tv * W + tu
    warped_flat[target_flat] = flat_img[src_idx]
    filled.reshape(-1)[target_flat] = True
    zbuf.reshape(-1)[target_flat] = zp  # nearest z wins (written last)

    if fill_passes > 0:
        filled = _fill_small_gaps(warped, filled, zbuf, fill_passes)

    hole_mask = np.where(filled, 0, 255).astype(np.uint8)
    return warped, hole_mask
