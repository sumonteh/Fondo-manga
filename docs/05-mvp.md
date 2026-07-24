# 05 — Plan de MVP

> Recorte al mínimo que demuestra el valor central de Fondo-manga y el primer spike técnico
> ejecutable **esta semana**. Base: `01`–`04`.
> Rigor: `[DECISIÓN]` (mía) · `[VERIFICADO]` (con URL) · `[INFERIDO]` · `desconocido`.
> Fecha: 2026-07-24.

---

## 1. Hipótesis de valor a probar

> **"Dada UNA imagen de fondo, puedo re-encuadrarla desde otro ángulo de cámara y obtener una
> salida en line-art coherente, útil para pegar en una página de manga."**

Si esto funciona con calidad aceptable en **ángulos moderados** (el mismo régimen donde Ore-Ashi
funciona bien, `01 §2`), el resto (multi-input, planes, editor, 4K, props 360) es incremental.
`[DECISIÓN]`

---

## 2. Alcance del MVP (in / out)

**IN — lo mínimo imprescindible:**
- Subir/seleccionar **1 imagen** de fondo (generada fuera o subida). `[DECISIÓN]`
- Control de **un ángulo de cámara** (yaw + pitch acotados, p.ej. ±30°). `[DECISIÓN]`
- Pipeline **Fake-3D** de `03`: depth → warp → SDXL anime + ControlNet-Depth + ControlNet-Lineart
  + seed + referencia → inpaint. `[DECISIÓN]`
- Salida **line-art** (una sola variante de estilo para empezar). `[DECISIÓN]`
- Job asíncrono con estado (queue + polling) y descarga PNG. `[DECISIÓN]`

**OUT — deliberadamente pospuesto:**
- Generación desde prompt/nemu (F1/F2), imagen de referencia avanzada (F3), variantes múltiples.
- Estilos línea+gris / línea+trama, resolución 4K, props 360 (TRELLIS).
- Auth completa, créditos/pagos, MFA, editor de retoque fino (F6), export PSD por capas.
- Proxy geométrico MoGe/DA3 (optimización posterior).

> El MVP corre con **auth mínima o sin auth** en entorno privado y **sin sistema de créditos**
> (se mide GPU-segundo por log). El negocio se añade tras validar el valor. `[DECISIÓN]`

---

## 3. Primer spike técnico (ESTA SEMANA) ★

**Meta del spike:** validar la hipótesis §1 end-to-end en un notebook/script, **sin front ni
API**, midiendo calidad y GPU-segundos reales.

**Entorno:** 1× **RTX 4090 on-demand** (Vast.ai ~$0.29–0.59/hr o TensorDock ~$0.25/hr, `04 §7`)
`[VERIFICADO]`, con **ComfyUI** o script Python + `diffusers`.

**Pasos concretos:**
1. **Setup GPU + modelos** (licencia comercial, `03`):
   - Depth Anything V2-**Small** (Apache) `[VERIFICADO]` o Marigold (Apache).
   - SDXL/Illustrious anime + **ControlNet-Depth** + **ControlNet-Lineart-anime** `[VERIFICADO]`.
2. **Depth + warp:** estimar depth de la imagen fuente y **re-proyectarla** a una cámara con
   yaw −20° (usar un warp por depth simple: unproject → rotate → reproject; genera huecos).
3. **Re-generación:** pasar el warp por SDXL anime con ControlNet-Depth (del depth de la nueva
   cámara) + ControlNet-Lineart, **img2img + inpaint** de huecos, **seed fija** + imagen fuente
   como referencia.
4. **Barrido de ángulos:** repetir a −10°/−20°/−30°/−45° y **anotar** dónde empieza a alucinar
   (buscar el umbral, comparable al de Ore-Ashi). `[DECISIÓN]`
5. **Medir:** GPU-segundos por rotación (para calibrar los costes `[INFERIDO]` de `04 §6`) y
   evaluar coherencia de estilo/perspectiva de forma cualitativa.

**Criterio de éxito del spike `[DECISIÓN]`:**
- A ±20° la salida mantiene estructura de escena y **estilo line-art** reconocible, con huecos
  rellenados de forma plausible.
- GPU-tiempo por rotación dentro del rango estimado (~20–40 s → confirma o corrige `04 §6`).
- Queda claro el **umbral de ángulo** a exponer en la UI del MVP.

**Entregable del spike:** un script/notebook reproducible + una tabla de "ángulo → calidad →
GPU-seg" + 3–5 ejemplos visuales. `[DECISIÓN]`

---

## 4. Backlog priorizado (post-spike)

| Prioridad | Épica | Historia | Depende de |
|---|---|---|---|
| **P0** | Spike | Validar Fake-3D rotación ±30° en 4090 (script) | — |
| **P0** | Inferencia | Empaquetar pipeline como **worker** (ComfyUI headless / FastAPI) | Spike |
| **P0** | API | `POST /rotate` + `GET /jobs/{id}` + upload (`04 §4`) | Worker |
| **P0** | Front | Subir imagen + slider de ángulo + ver resultado + descargar (sobre `index.html`) | API |
| **P1** | Cola | Redis + reintentos + medición GPU-seg | Worker |
| **P1** | Storage | S3/R2 + URLs firmadas | API |
| **P1** | Calidad | Proxy geométrico **MoGe/DA3** para mejorar ángulos medios (verificar licencia) | Spike |
| **P1** | Estilos | Añadir línea+gris / línea+trama (capas, patrón de `02 §2`) | Front |
| **P2** | Generación | F1/F2 (prompt/nemu → line-art) reutilizando la misma pila | Worker |
| **P2** | Negocio | Auth + créditos (ledger) + Stripe + refund (`04 §4`) | API |
| **P2** | Props | TRELLIS (MIT) para rotación 360 de objetos | Worker |
| **P3** | Editor | Retoque/inpaint por región (F6), export PSD por capas (F7) | Front |

---

## 5. Hitos

| Hito | Contenido | Señal de "hecho" |
|---|---|---|
| **M0 (semana 1)** | Spike técnico (§3) | rotación ±20–30° en line-art + tabla ángulo/calidad/GPU-seg |
| **M1 (semanas 2–3)** | MVP demoable | subir imagen → rotar → descargar PNG, end-to-end async |
| **M2 (semanas 4–6)** | MVP robusto | cola + storage + MoGe + estilos de capa + medición de costes real |
| **M3 (semanas 7+)** | Producto | generación F1/F2 + créditos/pagos + props 360 |

---

## 6. Riesgos del MVP y mitigación

| Riesgo | Mitigación |
|---|---|
| El warp+difusión no da perspectiva convincente ni a ±20° | probar proxy **MoGe** (point-map) en el propio spike como plan B; acotar más el ángulo |
| Deriva de estilo entre fuente y rotación | seed fija + imagen de referencia + (si hace falta) LoRA de estilo |
| Latencia > presupuesto | bajar resolución interna, usar Depth Anything V2-Small (10× más rápido que Marigold `[VERIFICADO]`) |
| Licencia de MoGe/DA3 resulta NC | sustituir por DA2-Small/Marigold (Apache), ya en el pipeline base |
| Alcance se dispara | congelar OUT de §2 hasta pasar M1 |

---

## 7. Resumen ejecutivo de Fase 5

- **MVP = una imagen → rotar cámara (±30°) → line-art coherente**, sin auth/créditos/generación,
  con job async y descarga PNG. Todo lo demás es incremental.
- **Spike de esta semana**: validar el pipeline Fake-3D de `03` en un **4090 on-demand**, barrer
  ángulos, encontrar el umbral de alucinación y **medir GPU-segundos** para calibrar los costes
  estimados en `04 §6`.
- **Backlog** priorizado P0→P3 y **hitos M0→M3** encadenan spike → MVP demoable → MVP robusto →
  producto (generación + negocio + props).

---

## Cierre del análisis (Fases 1–5)

| Fase | Doc | Entregable |
|---|---|---|
| 1 | `01-recon.md` | Superficie pública de Ore-Ashi, feature 1枚絵ロケ, negocio, términos |
| 2 | `02-features.md` | Mapa funcional feature-por-feature + flujo Mermaid |
| 3 | `03-pipeline-3d.md` | Comparativa de familias 3D + recomendación Fake-3D (self-host, comercial) |
| 4 | `04-arquitectura.md` | Mi sistema: stack, API/JSON schemas, costos, diagramas Mermaid |
| 5 | `05-mvp.md` | Recorte MVP, backlog, hitos, primer spike |

**Recordatorio de rigor:** todo lo marcado `desconocido` (planes individuales exactos, créditos
por operación, stack/endpoints/CDN de Ore-Ashi, licencias de MoGe/DA3/Bolt3D, latencias reales)
lleva su **método de averiguación**; **nada de endpoints, precios ni modelos fue inventado**.
