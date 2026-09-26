# 07 — Estado del spike M0 y cómo retomar

> Nota de continuidad: dónde quedamos tras la primera sesión en GPU real y qué
> sigue. Lee solo este archivo para retomar. Fecha: 2026-09-09.

---

## Estado: concepto VALIDADO en GPU real ✅

Se probó el pipeline completo en un **RTX 5090 (Vast.ai, imagen `vastai/pytorch:cuda-13.2.1-auto`)**
con una foto real (un estudio victoriano). Resultado: **la misma escena re-encuadrada
desde otro ángulo de cámara** — 1枚絵ロケ funciona.

**Números reales medidos (5090):**
- Rotación completa ≈ **11 s** (depth ~4 s con warm-up + warp 0.01 s + difusión ~7 s).
- Coste ≈ **$0.0012 por render** a $0.39/hr. (Confirma/mejora la estimación `[INFERIDO]` de `docs/04 §6`.)

## Qué funciona
- **Geometría** (`fake3d/camera.py`, `fake3d/warp.py`): reproyección + warp por profundidad, CPU, `selftest.py` 5/5.
- **Depth** (`fake3d/depth.py`): Depth Anything V2-Small (Apache).
- **Dos modos** (`fake3d/restyle.py`, flag `--mode`):
  - `reproject` — **fiel**: misma foto, otro ángulo, sin line-art (para validar la geometría).
  - `lineart` — restyle manga completo (img2img + ControlNet depth+lineart).

## Problema abierto principal: distorsión del warp
El modo `reproject` mostró la escena correcta pero **"derretida"** con patrón de puntos.
Causa: warp por **splat de 1 píxel** (no malla) + rango de profundidad.
Ya mitigado (PR #9): profundidad comprimida a ~3× + más relleno de huecos.
**Pendiente de probar** el resultado a `--yaw -8` con esos cambios (la instancia se apagó antes).

## Próximos pasos (en orden)
1. **Reprobar `reproject` a `--yaw -8`** con los últimos cambios → ver si la distorsión bajó a aceptable.
2. **Warp por malla (triángulos)** en `fake3d/warp.py` — elimina de raíz el patrón de puntos del splat. Es CPU, verificable con `selftest.py`. *La mejora de calidad más grande pendiente.*
3. **Sweep de ángulos** (`sweep.py`) con foto real → tabla ángulo→`hole_ratio`→GPU-seg → fija el **umbral de ángulo** de la UI del MVP.
4. **Estilo manga**: override `FONDO_CN_LINEART=r3gm/controlnet-lineart-anime-sdxl-fp16` y/o checkpoint base anime + tuning de `denoise`/prompt.
5. Con los números, arrancar el **backend de `docs/04`** (`/rotate` async en RunPod Serverless).

## Cómo retomar (máquina nueva, ~5 min de setup)
```bash
# 1. Alquilar RTX 4090/5090 en Vast.ai con imagen vastai/pytorch:cuda-13.2.1-auto, disco >=40 GB
# 2. En Jupyter Terminal:
git clone https://github.com/sumonteh/Fondo-manga.git   # user: sumonteh, pass: PAT github_pat_...
cd Fondo-manga
bash spike/setup.sh                                      # instala + selftest + smoke sweep
# 3. Subir una foto real a spike/examples/ (JupyterLab Upload) y:
python spike/rotate.py --image spike/examples/TUFOTO.jpg --yaw -8 --mode reproject --out spike/examples/out/r.png
```
Los modelos (~14 GB) se re-descargan solos la primera vez (~15 min). Ver `docs/06-runbook-gpu.md` para el detalle (token PAT, etc.).

## Knobs / variables de entorno útiles
| Variable / flag | Efecto |
|---|---|
| `--mode reproject` / `lineart` | fiel (sin estilo) vs. restyle manga |
| `--yaw` / `--pitch` | ángulo de cámara (empezar chico: −8 a −12) |
| `FONDO_DEPTH_RANGE` (def. 3.0) | rango cerca/lejos; súbelo para calles/paisajes, bájalo si distorsiona |
| `FONDO_CN_LINEART` | override del ControlNet de line-art (p.ej. el anime) |
| `FONDO_LOWVRAM=1` | offload a CPU en GPUs ≤16 GB |
| `restyle.py` `denoise` | 0.4–0.6 más fiel a la estructura; 0.8 estiliza más |

## Historial de PRs mergeados a `main` (contexto)
#2 análisis+spike · #3 setup.sh · #4 runbook+hardening · #5 fix resolución SDXL ·
#6 restyle img2img · #7 modo reproject · #8 fix ControlNet único · #9 anti-distorsión.

## ⚠️ Recordatorio de costos
Apagar la instancia al terminar (**Stop** si retomas pronto; **Destroy** para $0 garantizado —
solo se pierden modelos descargados e imágenes no bajadas; el código está todo en `main`).
