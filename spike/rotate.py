"""End-to-end fake-3D rotation of a single image (GPU entrypoint).

    python spike/rotate.py --image in.png --yaw -20 --out out.png

Pipeline (docs/03 Family C):
    depth -> forward warp to new camera -> line-art re-generation + inpaint

The geometry (depth + warp) is CPU/NumPy and is what ``selftest.py`` validates.
The depth model and the diffusion re-styler need a GPU; they are imported lazily
so this file parses and ``--dry-run`` works without torch installed.
"""

from __future__ import annotations

import argparse
import time

import numpy as np
from PIL import Image


def run(
    image_path: str,
    out_path: str,
    yaw: float,
    pitch: float,
    dolly: float,
    seed: int,
    dry_run: bool,
) -> dict:
    img = Image.open(image_path).convert("RGB")
    rgb = np.asarray(img)

    t0 = time.time()

    if dry_run:
        # No models: fake a depth ramp so the warp still runs on CPU.
        H, W = rgb.shape[:2]
        depth = np.linspace(1.0, 4.0, W)[None, :].repeat(H, axis=0)
    else:
        from fake3d.depth import estimate_depth

        depth = estimate_depth(img)
    t_depth = time.time()

    from fake3d.warp import forward_warp

    warped, holes = forward_warp(rgb, depth, yaw_deg=yaw, pitch_deg=pitch, dolly=dolly)
    hole_ratio = float((holes > 0).mean())
    t_warp = time.time()

    if dry_run:
        # Save the geometric proxy + the line-art hint so you can eyeball both
        # without a GPU (the hint uses the NumPy CPU fallback).
        from fake3d.restyle import lineart_preprocess

        Image.fromarray(warped).save(out_path)
        hint_path = out_path.rsplit(".", 1)[0] + ".lineart.png"
        lineart_preprocess(Image.fromarray(warped), method="anime").save(hint_path)
        result_meta = {"restyled": False, "lineart_hint": hint_path}
        t_style = t_warp
    else:
        from fake3d.depth import estimate_depth  # noqa: F401 (already imported)
        from fake3d.restyle import lineart_preprocess, restyle_to_lineart

        new_img = Image.fromarray(warped)
        new_depth = estimate_depth(new_img)
        depth_ctrl = Image.fromarray(
            (255 * (new_depth.max() - new_depth) / (np.ptp(new_depth) + 1e-8)).astype("uint8")
        ).convert("RGB")
        # Line-art hint from the warped proxy (LineartAnimeDetector on GPU).
        lineart_ctrl = lineart_preprocess(new_img, method="anime")
        out = restyle_to_lineart(warped, holes, depth_ctrl, lineart_ctrl, seed=seed)
        out.save(out_path)
        result_meta = {"restyled": True}
        t_style = time.time()

    return {
        "yaw": yaw,
        "pitch": pitch,
        "hole_ratio": round(hole_ratio, 4),
        "sec_depth": round(t_depth - t0, 3),
        "sec_warp": round(t_warp - t_depth, 3),
        "sec_restyle": round(t_style - t_warp, 3),
        "sec_total": round(t_style - t0, 3),
        **result_meta,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Fake-3D single-image camera rotation")
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", default="rotated.png")
    ap.add_argument("--yaw", type=float, default=-20.0)
    ap.add_argument("--pitch", type=float, default=0.0)
    ap.add_argument("--dolly", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=12345)
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="CPU-only: skip models, save the geometric warp proxy",
    )
    args = ap.parse_args()

    meta = run(
        args.image, args.out, args.yaw, args.pitch, args.dolly, args.seed, args.dry_run
    )
    print(meta)
    print(f"saved -> {args.out}")


if __name__ == "__main__":
    main()
