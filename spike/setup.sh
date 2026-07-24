#!/usr/bin/env bash
# One-shot setup for the M0 fake-3D rotation spike on a fresh GPU box
# (Vast.ai / TensorDock / RunPod RTX 4090). Installs deps, runs the CPU
# self-test, and does a smoke sweep so you know the box is ready.
#
#   bash spike/setup.sh              # auto-detects GPU; installs the right deps
#   CPU_ONLY=1 bash spike/setup.sh   # force the CPU-only path (geometry + hint)
#
# Safe to re-run. Assumes Python 3.10+ and pip are present (they are on the
# standard PyTorch cloud templates).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Fondo-manga spike setup (dir: $SCRIPT_DIR)"

# --- Detect GPU -------------------------------------------------------------
HAS_GPU=0
if [ "${CPU_ONLY:-0}" != "1" ] && command -v nvidia-smi >/dev/null 2>&1; then
  if nvidia-smi -L >/dev/null 2>&1; then
    HAS_GPU=1
    echo "==> GPU detected:"
    nvidia-smi -L || true
  fi
fi
[ "$HAS_GPU" -eq 0 ] && echo "==> No GPU (or CPU_ONLY=1): CPU-only path (geometry + line-art hint)."

# --- Python deps ------------------------------------------------------------
PY="${PYTHON:-python3}"
echo "==> Using $($PY --version 2>&1)"
# Best-effort; some distro-managed pips can't self-upgrade (not essential).
$PY -m pip install --upgrade pip >/dev/null 2>&1 || echo "    (pip self-upgrade skipped)"

echo "==> Installing CPU deps (numpy, pillow)"
$PY -m pip install --quiet numpy pillow

if [ "$HAS_GPU" -eq 1 ]; then
  echo "==> Installing GPU deps (torch, diffusers, transformers, controlnet-aux)"
  # torch is preinstalled on most GPU templates; only install if missing so we
  # don't fight the template's CUDA build.
  if ! $PY -c "import torch" >/dev/null 2>&1; then
    echo "    torch not found -> installing default CUDA build (adjust if needed)"
    $PY -m pip install --quiet torch
  else
    echo "    torch present: $($PY -c 'import torch; print(torch.__version__)')"
  fi
  $PY -m pip install --quiet transformers diffusers accelerate controlnet-aux
fi

# --- Verify: CPU geometry self-test (must always pass) ----------------------
echo "==> Running CPU self-test (geometry + warp)"
$PY selftest.py

# --- Smoke test -------------------------------------------------------------
if [ ! -f examples/scene.png ]; then
  echo "==> examples/scene.png missing; skipping smoke sweep"
elif [ "$HAS_GPU" -eq 1 ]; then
  echo "==> GPU smoke: single real rotation (downloads models on first run)"
  $PY rotate.py --image examples/scene.png --yaw -20 --out examples/out/smoke.png
  echo "==> Full sweep:"
  $PY sweep.py --image examples/scene.png --angles -10 -20 -30 -45
  echo "==> Results in examples/out/results.md"
else
  echo "==> CPU smoke: dry-run sweep (geometry + hint, no diffusion)"
  $PY sweep.py --image examples/scene.png --angles -10 -20 -30 -45 --dry-run
  echo "==> Results (hole_ratio + timings) in examples/out/results.md"
fi

echo ""
echo "==> Done."
if [ "$HAS_GPU" -eq 1 ]; then
  echo "    Next: inspect examples/out/*.png and results.md; tune knobs in"
  echo "    fake3d/restyle.py (denoise, depth_scale, lineart_scale, prompt)."
else
  echo "    CPU path OK. Run on an RTX 4090 (see README.md) for the real"
  echo "    line-art diffusion and the angle->quality->GPU-seconds table."
fi
