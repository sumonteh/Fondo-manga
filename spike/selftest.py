"""CPU-only self-test for the fake-3D geometry (no GPU, no ML models).

Validates the highest-risk part of the pipeline — the camera reprojection and
depth warp — on synthetic scenes. Run with::

    python spike/selftest.py

Exits non-zero on failure so it can gate CI.
"""

from __future__ import annotations

import sys

import numpy as np

from fake3d.camera import intrinsics_from_fov, orbit_rotation, reproject
from fake3d.warp import forward_warp


def _checker(h: int, w: int) -> np.ndarray:
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    c = (((xx // 8) + (yy // 8)) % 2) * 255
    return np.stack([c, c, c], axis=-1).astype(np.uint8)


def test_identity_is_lossless() -> None:
    """Zero rotation + zero dolly must reproduce the image with no holes."""
    h, w = 64, 96
    img = _checker(h, w)
    depth = np.full((h, w), 2.0)
    warped, holes = forward_warp(img, depth, yaw_deg=0.0)
    assert holes.sum() == 0, "identity warp produced holes"
    assert np.array_equal(warped, img), "identity warp changed pixels"


def test_reprojection_identity_coords() -> None:
    """With R = I and no dolly, reprojected pixel coords equal the originals."""
    h, w = 40, 50
    K = intrinsics_from_fov(w, h)
    vv, uu = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    u, v = uu.ravel().astype(float), vv.ravel().astype(float)
    z = np.full(u.shape, 3.0)
    R = orbit_rotation(0.0, 0.0)
    uv, zp = reproject(u, v, z, K, R, pivot_depth=3.0)
    assert np.allclose(uv[:, 0], u, atol=1e-6), "u drifted under identity"
    assert np.allclose(uv[:, 1], v, atol=1e-6), "v drifted under identity"
    assert np.allclose(zp, z, atol=1e-6), "z drifted under identity"


def test_yaw_shifts_horizontally() -> None:
    """A yaw rotation must move off-center points horizontally, consistently."""
    h, w = 40, 60
    K = intrinsics_from_fov(w, h)
    # A single point to the right of center, at the pivot depth.
    u = np.array([float(w - 5)])
    v = np.array([float(h // 2)])
    z = np.array([2.0])
    uv_pos, _ = reproject(u, v, z, K, orbit_rotation(+15.0, 0.0), pivot_depth=2.0)
    uv_neg, _ = reproject(u, v, z, K, orbit_rotation(-15.0, 0.0), pivot_depth=2.0)
    # Opposite yaw signs must push the point to opposite horizontal sides.
    assert (uv_pos[0, 0] - u[0]) * (uv_neg[0, 0] - u[0]) < 0, "yaw sign not antisymmetric"


def test_depth_discontinuity_creates_holes() -> None:
    """A depth step must disocclude (produce holes) under yaw, unlike a flat wall."""
    h, w = 64, 96
    img = _checker(h, w)
    flat = np.full((h, w), 2.0)
    step = np.full((h, w), 2.0)
    step[:, w // 2 :] = 6.0  # far background on the right half

    _, holes_flat = forward_warp(img, flat, yaw_deg=18.0)
    _, holes_step = forward_warp(img, step, yaw_deg=18.0)

    # The depth step must reveal meaningfully more disoccluded area than a
    # single flat plane at the same angle.
    assert holes_step.sum() > holes_flat.sum() * 1.5, "depth step did not disocclude"


def test_larger_yaw_more_holes() -> None:
    """Monotonicity: bigger rotations hallucinate more (matches Ore-Ashi's limit)."""
    h, w = 64, 96
    img = _checker(h, w)
    depth = np.full((h, w), 2.0)
    depth[:, w // 2 :] = 5.0
    areas = []
    for yaw in (5.0, 15.0, 30.0, 45.0):
        _, holes = forward_warp(img, depth, yaw_deg=yaw)
        areas.append(holes.sum())
    assert areas == sorted(areas), f"hole area not monotonic in yaw: {areas}"


def main() -> int:
    tests = [
        test_identity_is_lossless,
        test_reprojection_identity_coords,
        test_yaw_shifts_horizontally,
        test_depth_discontinuity_creates_holes,
        test_larger_yaw_more_holes,
    ]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL  {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
