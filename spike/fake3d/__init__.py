"""Fake-3D rotation spike package.

The ``camera`` and ``warp`` modules are pure NumPy (CPU, no ML deps) and are
covered by ``selftest.py``. The ``depth`` and ``restyle`` modules require a GPU
(torch + diffusers/transformers) and are imported lazily by ``rotate.py`` so
that the CPU self-test can run without those heavy dependencies installed.
"""
