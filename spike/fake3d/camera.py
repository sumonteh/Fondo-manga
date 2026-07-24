"""Camera geometry for the fake-3D rotation spike.

Pure NumPy, CPU-only, no ML dependencies. This is the highest-risk part of the
pipeline (getting the perspective right), so it is isolated here and covered by
``selftest.py`` which runs without a GPU.

Conventions (OpenCV-style):
    - Image coordinates: u to the right, v downwards.
    - Camera coordinates: x right, y down, z forward (into the scene).
    - Depth ``z`` is the distance along the camera's forward axis.
"""

from __future__ import annotations

import numpy as np


def intrinsics_from_fov(width: int, height: int, fov_deg: float = 55.0) -> np.ndarray:
    """Build a 3x3 pinhole intrinsics matrix from a horizontal field of view."""
    fov = np.deg2rad(fov_deg)
    fx = 0.5 * width / np.tan(0.5 * fov)
    fy = fx  # square pixels
    cx = 0.5 * width
    cy = 0.5 * height
    return np.array([[fx, 0.0, cx], [0.0, fy, cy], [0.0, 0.0, 1.0]], dtype=np.float64)


def rot_x(pitch_deg: float) -> np.ndarray:
    a = np.deg2rad(pitch_deg)
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)


def rot_y(yaw_deg: float) -> np.ndarray:
    a = np.deg2rad(yaw_deg)
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)


def orbit_rotation(yaw_deg: float, pitch_deg: float) -> np.ndarray:
    """Rotation matrix for orbiting the camera by (yaw, pitch)."""
    return rot_x(pitch_deg) @ rot_y(yaw_deg)


def unproject(u: np.ndarray, v: np.ndarray, z: np.ndarray, K: np.ndarray) -> np.ndarray:
    """Back-project pixel grid + depth to camera-space 3D points.

    Returns an array of shape ``(N, 3)``.
    """
    fx, fy = K[0, 0], K[1, 1]
    cx, cy = K[0, 2], K[1, 2]
    x = (u - cx) * z / fx
    y = (v - cy) * z / fy
    return np.stack([x, y, z], axis=-1)


def project(points: np.ndarray, K: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Project camera-space points to pixels. Returns ``(uv, z)``.

    ``uv`` has shape ``(N, 2)``; ``z`` is the forward depth of each point.
    """
    fx, fy = K[0, 0], K[1, 1]
    cx, cy = K[0, 2], K[1, 2]
    z = points[:, 2]
    safe_z = np.where(np.abs(z) < 1e-8, 1e-8, z)
    u = fx * points[:, 0] / safe_z + cx
    v = fy * points[:, 1] / safe_z + cy
    return np.stack([u, v], axis=-1), z


def reproject(
    u: np.ndarray,
    v: np.ndarray,
    z: np.ndarray,
    K: np.ndarray,
    R: np.ndarray,
    pivot_depth: float,
    dolly: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproject a pixel grid to a new camera orbited by ``R`` around a pivot.

    The camera orbits a point on the optical axis at depth ``pivot_depth`` and
    optionally dollies forward/back by ``dolly`` (in scene units). Returns the
    new ``(uv, z')`` for every input pixel.
    """
    pivot = np.array([0.0, 0.0, pivot_depth], dtype=np.float64)
    t = np.array([0.0, 0.0, dolly], dtype=np.float64)
    P = unproject(u, v, z, K)
    Pp = (R @ (P - pivot).T).T + pivot + t
    return project(Pp, K)
