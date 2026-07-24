# Spike M0 — Fake-3D rotación de una imagen → line-art

Primer spike técnico de `docs/05-mvp.md`. Valida la hipótesis central del
producto: **dada UNA imagen de fondo, re-encuadrarla desde otro ángulo de cámara
con salida line-art coherente**, usando el pipeline **Familia C "Fake-3D"** de
`docs/03-pipeline-3d.md`:

```
depth (Depth Anything V2-Small) → warp por profundidad a la cámara nueva
   → re-generación line-art (SDXL + ControlNet Depth + ControlNet Lineart + inpaint)
```

## Qué es verificable sin GPU (ya probado en CI/CPU)

La **geometría** (lo de mayor riesgo) es NumPy puro y no necesita GPU:

```bash
pip install -r requirements.txt          # solo numpy + pillow para esto
python selftest.py                       # 5/5 tests de cámara/warp deben pasar
python rotate.py --image examples/scene.png --yaw -20 --dry-run --out proxy.png
python sweep.py  --image examples/scene.png --angles -10 -20 -30 -45 --dry-run
```

- `selftest.py` comprueba: reproyección identidad *lossless*, antisimetría del
  yaw, y que **las discontinuidades de profundidad generan huecos crecientes con
  el ángulo** (la firma de 1枚絵ロケ).
- `--dry-run` salta los modelos y guarda el **proxy geométrico** (el warp "roto"
  con huecos), midiendo `hole_ratio` y tiempos. Sirve para inspeccionar el warp
  sin GPU. *(Con la profundidad sintética burda + splat de 1 píxel, el
  `hole_ratio` sobreestima la des-oclusión real; en el run real se usa la
  profundidad densa de Depth Anything y, idealmente, warp por malla — ver
  Limitaciones.)*

## Ejecución REAL (en tu RTX 4090)

### 1. Alquilar GPU
RTX 4090 on-demand — **Vast.ai** (~$0.29–0.59/hr) o **TensorDock** (~$0.25/hr).
24 GB cubren todo el pipeline (`docs/04 §7`). Para servir en prod luego:
**RunPod Serverless 4090** (~$1.10/hr activo, $0 idle).

### 2. Instalar
```bash
pip install -r requirements.txt
# descomenta y ajusta el bloque GPU de requirements.txt a tu CUDA:
pip install "torch>=2.2" transformers diffusers accelerate controlnet-aux
```

### 3. Rotar y barrer ángulos
```bash
python rotate.py --image examples/scene.png --yaw -20 --out rotado.png
python sweep.py  --image examples/scene.png --angles -10 -20 -30 -45
# → examples/out/results.csv + results.md (tabla ángulo → calidad → GPU-seg)
```

## Criterio de éxito del spike (docs/05 §3)

1. A **±20°** la salida mantiene estructura de escena y **estilo line-art**
   reconocible, con huecos rellenados de forma plausible.
2. `sec_total` por rotación cae en el rango estimado (~20–40 s) → **confirma o
   corrige** los costes `[INFERIDO]` de `docs/04 §6`.
3. El barrido revela el **umbral de yaw** donde `hole_ratio` se dispara → es el
   rango de ángulo a exponer en la UI del MVP (como hace Ore-Ashi limitando la
   rotación).

## Estructura

```
spike/
  fake3d/
    camera.py    # intrínsecos, rotaciones, unproject/project/reproject  (CPU, testeado)
    warp.py      # forward warp con z-buffer + máscara de huecos          (CPU, testeado)
    depth.py     # Depth Anything V2-Small (Apache-2.0)                    (GPU)
    restyle.py   # SDXL + ControlNet Depth+Lineart + inpaint              (GPU)
  rotate.py      # entrypoint 1 imagen + ángulo → line-art (--dry-run CPU)
  sweep.py       # barrido de ángulos → results.csv/md
  selftest.py    # tests de geometría CPU-only (gate de CI)
  examples/scene.png  # escena sintética de prueba
```

## Knobs a tunear en el spike (restyle.py)
`denoise` (fuerza img2img), `depth_scale` / `lineart_scale` (peso de cada
ControlNet), `seed` (coherencia entre vistas), y el `prompt` de line-art.

## Limitaciones (honestas)
- El warp es un forward splat + **relleno de huecos guiado por z-buffer**
  (`fill_passes`): cierra los gaps de *resampling* desde el vecino más cercano en
  profundidad (foreground) y deja abiertos solo los **huecos de des-oclusión
  reales** — así `hole_ratio` mide "cuánto hay que alucinar" y no ruido de
  muestreo (verificado en CPU: rampa suave 701→0 huecos; escalón de profundidad
  3158→2245). Para máxima calidad en prod, migrar a **warp por malla
  (triángulos)** y/o proxy **MoGe/DA3** (point-map denso) — ver `docs/03 §3` y
  backlog P1 en `docs/05 §4`.
- La perspectiva del re-styler es **plausible, no milimétrica** (la difusión
  interpreta la proxy). Acotar el rango de ángulo mitiga (docs/03 §5).
- **Licencias**: usar Depth Anything V2-**Small** (Apache) — no Base/Large/Giant
  (CC-BY-NC); verificar el checkpoint base SDXL anime antes de uso comercial.
