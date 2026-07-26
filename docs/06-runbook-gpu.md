# 06 — Runbook GPU: de arrendar la GPU a probar que la app funciona

> Guía paso a paso para ejecutar el spike M0 (`spike/`) en la GPU **más
> económica y práctica** y validar el valor central: **1 imagen → rotar cámara →
> line-art coherente** (1枚絵ロケ). Base: `04-arquitectura.md §7`, `05-mvp.md §3`,
> `spike/README.md`. Precios verificados jul-2026 (`docs/04`).

**Coste total estimado de esta prueba:** < **$1** (instalación + prueba en
~15–30 min; luego cada rotación son segundos). ⚠️ **Apaga la instancia al
terminar** o seguirá facturando por hora.

---

## Elección de proveedor

Uso **Vast.ai** (RTX 4090 marketplace, ~$0.29–0.59/hr) por ser lo más barato con
un contenedor real (terminal + Jupyter). Alternativas (`docs/04 §7`):
- **Salad** ~$0.20/hr — más barato pero red de PCs de consumo, encaja peor con
  `clone + script`.
- **TensorDock** ~$0.25/hr — buen equilibrio precio/fiabilidad.
- **RunPod** $0.34–0.69/hr — mejor DX; y **RunPod Serverless** para producción.

---

## Paso 0 — Token para el repo privado (2 min)
`sumonteh/Fondo-manga` es privado; el `git clone` necesita autenticación.

1. Abre **https://github.com/settings/personal-access-tokens/new**
   (Fine-grained token; ruta manual: Settings → Developer settings → Personal
   access tokens → Fine-grained tokens → Generate new token).
2. Rellena:
   - **Token name:** `fondo-manga-clone`
   - **Expiration:** 30 días
   - **Resource owner:** `sumonteh`
   - **Repository access:** *Only select repositories* → **`Fondo-manga`**
   - **Permissions → Repository → Contents:** **Read-only** (con eso basta)
3. **Generate token** y **copia** el `github_pat_…` (no se vuelve a mostrar).

## Paso 1 — Cuenta y saldo en Vast.ai (5 min)
1. **vast.ai → Sign up**.
2. **Billing → Add credit** ($5–$10 sobra).

## Paso 2 — Alquilar una RTX 4090 (3 min)
1. **Console → Search** (Rent GPUs).
2. Filtros:
   - **GPU:** RTX 4090
   - **Disk:** ≥ **40 GB** (SDXL + ControlNet pesan ~15–20 GB)
   - Ordena por **$/hr** ascendente; prefiere **reliability > 0.98**.
3. **Imagen/plantilla:** una con **PyTorch + CUDA 12.x** preinstalado (así
   `setup.sh` no reinstala torch).
4. Habilita **Jupyter** y/o **SSH** → **Rent**.

## Paso 3 — Conectarte (2 min)
- **Console → Instances**; cuando esté **Running**, abre **Jupyter** →
  **New → Terminal**, o conéctate por **SSH** con el comando que muestra Vast.

## Paso 4 — Clonar y arrancar (1 comando)
```bash
git clone https://github.com/sumonteh/Fondo-manga.git
# Username: sumonteh   |   Password: pega el github_pat_…
cd Fondo-manga
bash spike/setup.sh
```
`setup.sh` detecta la GPU, instala las deps que falten, corre el self-test y
lanza el **sweep real** (descarga de modelos la 1ª vez → ~5–10 min).

## Paso 5 — Qué verás si funciona (la prueba)
El script imprime en orden:
1. `==> GPU detected: … RTX 4090` ✅
2. `5/5 passed` ✅ (geometría correcta)
3. `==> GPU smoke: single real rotation` → `examples/out/smoke.png`
4. `==> Full sweep:` (−10/−20/−30/−45°) → `examples/out/results.md` + PNGs

**La prueba son los archivos de salida:**
```bash
ls -la examples/out/          # smoke.png, yaw_-10.png … yaw_-45.png, results.md
cat examples/out/results.md   # tabla ángulo → hole_ratio → sec_total (GPU real)
```
- Abre `examples/out/yaw_-20.png`: debe ser **la misma escena re-encuadrada
  desde otro ángulo, en line-art**. Eso es 1枚絵ロケ funcionando.
- Compara `yaw_-10` vs `yaw_-45`: a más ángulo, más zonas "inventadas" → verás
  el **umbral** donde deja de ser convincente (→ rango de la UI del MVP).

## Paso 6 — Probar con tu imagen
```bash
# sube una imagen (Jupyter: Upload), luego:
python spike/rotate.py --image mi_fondo.png --yaw -20 --out mi_rotado.png
```

## Paso 7 — Ajustar si hace falta (`spike/fake3d/restyle.py`)
- `denoise` (0.4–0.7): más alto = más limpieza/reinvención, menos fidelidad.
- `lineart_scale` / `depth_scale`: peso de cada ControlNet.
- `invert` en `lineart_preprocess`: si las líneas salen con polaridad invertida.

**Variables de entorno útiles (sin tocar código):**
- **GPU de ≤16 GB** (p.ej. RTX 5080): `export FONDO_LOWVRAM=1` antes de correr →
  activa `enable_model_cpu_offload` para que quepa. Con 24–32 GB no hace falta.
- **Cambiar un checkpoint** que no cargue: `FONDO_SDXL_BASE`, `FONDO_CN_DEPTH`,
  `FONDO_CN_LINEART` (apunta a un ControlNet SDXL en formato diffusers).

## Paso 8 — ⚠️ Apagar para dejar de pagar
**Console → Instances → Stop** (o **Destroy** si ya no la usas). Mientras esté
*Running* factura por hora aunque no la uses.

---

## Qué demuestra esto
Si `examples/out/yaw_-20.png` es la escena rotada en line-art coherente,
**validaste la hipótesis de valor del MVP** (`05-mvp.md §1`) y tienes datos
reales de `hole_ratio` + `sec_total` para **calibrar los costos `[INFERIDO]` de
`04-arquitectura.md §6`** y fijar el rango de ángulo de la UI.

**Siguiente paso natural:** con esos números, montar el backend de `docs/04`
(`/rotate` async sobre RunPod Serverless).
