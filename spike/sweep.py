"""Angle sweep harness — produces the 'angle -> quality -> GPU-seconds' table.

    python spike/sweep.py --image in.png --angles -10 -20 -30 -45

Writes ``results.csv`` and ``results.md`` next to the outputs. This is the core
deliverable of the M0 spike (docs/05 s.3): it finds the yaw threshold where
disocclusion (hole_ratio) starts to dominate — the same regime where Ore-Ashi
switches from "good" to "hallucinates", and hence the angle range to expose in
the MVP UI. Add ``--dry-run`` to measure geometry/holes on CPU without a GPU.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from rotate import run


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--angles", type=float, nargs="+", default=[-10, -20, -30, -45])
    ap.add_argument("--pitch", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=12345)
    ap.add_argument("--outdir", default="examples/out")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    rows = []
    for yaw in args.angles:
        out_path = str(outdir / f"yaw_{int(yaw)}.png")
        meta = run(
            args.image, out_path, yaw, args.pitch, 0.0, args.seed, args.dry_run
        )
        meta["out"] = out_path
        rows.append(meta)
        print(meta)

    fields = [
        "yaw", "pitch", "hole_ratio",
        "sec_depth", "sec_warp", "sec_restyle", "sec_total", "restyled", "out",
    ]
    with open(outdir / "results.csv", "w", newline="") as f:
        # extra meta keys (e.g. lineart_hint) are fine; only write known fields.
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    with open(outdir / "results.md", "w") as f:
        f.write("# Rotation sweep results\n\n")
        f.write("| yaw | hole_ratio | sec_depth | sec_warp | sec_restyle | sec_total |\n")
        f.write("|----:|-----------:|----------:|---------:|------------:|----------:|\n")
        for r in rows:
            f.write(
                f"| {r['yaw']:.0f} | {r['hole_ratio']:.3f} | {r['sec_depth']:.2f} "
                f"| {r['sec_warp']:.2f} | {r['sec_restyle']:.2f} | {r['sec_total']:.2f} |\n"
            )
        f.write(
            "\n**Interpreta:** el yaw donde `hole_ratio` se dispara marca el "
            "umbral a exponer en la UI del MVP (docs/05). `sec_total` calibra el "
            "coste por rotacion de docs/04.\n"
        )
    print(f"\nwrote {outdir/'results.csv'} and {outdir/'results.md'}")


if __name__ == "__main__":
    main()
