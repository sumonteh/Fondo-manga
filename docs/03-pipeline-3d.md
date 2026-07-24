# 03 — Deconstrucción técnica de "imagen → mundo 3D" (1枚絵ロケ)  ★ PRIORIDAD

> Objetivo: comparar TODAS las familias de solución viables hoy para "tomar UNA imagen
> y re-encuadrarla desde otro ángulo de cámara con coherencia de escena", con foco en
> **line-art de manga**, **self-host GPU** y **licencia comercial (requisito duro)**.
>
> Rigor: `[VERIFICADO]` (con URL) · `[INFERIDO]` · `desconocido` (+ método).
> Fecha de investigación: 2026-07-24. Base: `01`, `02`.

---

## 0. TL;DR (para decidir rápido)

- **Ninguna reconstrucción 3D "de verdad" desde una sola imagen es exacta**: todo método
  tiene que **alucinar lo ocluido**. La cuestión no es *si* se inventa, sino *quién* lo
  inventa mejor y con **estilo line-art coherente**.
- El comportamiento público de Ore-Ashi (bien en ángulos moderados, **inventa zonas
  ocluidas en ángulos grandes**, workaround por prompt) es la **firma de un re-render
  generativo / novel-view synthesis**, no de una malla geométrica exacta. `[INFERIDO]`
- **Restricción que descarta a los mejores modelos NVS**: **Stable Virtual Camera
  es Non-Commercial** y **CAT3D es cerrado (Google)**. `[VERIFICADO]`. Para un producto
  comercial self-host **quedan fuera**.
- **Recomendación:** **Familia 3 "Fake-3D pragmático"** = *depth/geometría monocular →
  re-proyección a cámara nueva → re-generación con ControlNet-depth + LoRA/ControlNet de
  line-art anime + seed + referencia de estilo → inpainting de oclusiones*. Todos los
  bloques tienen **licencia comercial permisiva** y corren en **24 GB**. Es la opción que
  mejor concilia *fidelidad de perspectiva*, *estilo line-art* y *licencia*.

---

## 1. Familias de solución

### Familia A — Reconstrucción geométrica real (depth → point cloud/mesh → re-render → inpaint)
Pipeline: estimar profundidad/geometría monocular → desproyectar a nube de puntos o malla →
colocar cámara nueva → renderizar → rellenar huecos (des-oclusión) con un modelo generativo.

Modelos de geometría monocular:

| Modelo | Salida | Licencia | Notas |
|---|---|---|---|
| **Depth Anything V2 – Small** | depth relativa | **Apache-2.0 (comercial OK)** | 10× más rápido que Marigold; el resto de tamaños (Base/Large/Giant) son **CC-BY-NC** (no comercial) `[VERIFICADO]` [issue 162](https://github.com/DepthAnything/Depth-Anything-V2/issues/162) |
| **Marigold (depth v1-1)** | depth relativa | **Apache-2.0 (comercial OK)** | difusión, más preciso pero más lento `[VERIFICADO]` [HF](https://huggingface.co/prs-eth/marigold-depth-v1-1) |
| **MoGe / MoGe-2 (Microsoft)** | **point map métrico + depth + normales + FOV** | `desconocido` — verificar en [repo](https://github.com/microsoft/moge) (código MS suele MIT; pesos por confirmar) | ideal para reconstrucción: da nube 3D + cámara directamente `[VERIFICADO]` capacidades [arXiv 2410.19115](https://arxiv.org/abs/2410.19115) |
| **Depth Anything 3** | multi-view point cloud + soporte 3DGS | `desconocido` — verificar | reconstrucción multi-vista consistente en tiempo real `[VERIFICADO]` [DA3 site](https://depth-anything-3.github.io/) |

- **Pros:** control de cámara **geométricamente exacto** (perspectiva perfecta para ángulos
  pequeños/medios); barato (una pasada de depth + render). Excelente para **props (小物)** y
  fondos con geometría clara (calles, interiores).
- **Contras:** en el re-render aparecen **huecos de des-oclusión** que exigen inpainting; la
  nube/malla de una sola vista es **"2.5D"** (una cáscara), no un volumen; el render crudo
  **no es line-art** → hay que re-estilizar. Detalle alto → artefactos (coincide con lo que
  admite Ore-Ashi). `[INFERIDO]`

### Familia B — Image-to-3D / Gaussian Splatting desde vista única
Genera un **activo 3D** (malla/gaussians/radiance field) directamente desde 1 imagen.

| Modelo | Salida | VRAM / latencia | Licencia |
|---|---|---|---|
| **TRELLIS (Microsoft)** | mesh / 3DGS / radiance field | **24 GB**, ~**30 s** en RTX 3090 | **MIT (comercial OK)** `[VERIFICADO]` [radiancefields](https://radiancefields.com/single-image-gaussian-splatting-in-2026-%E2%80%94-triposplat-vs-sharp-vs-trellis) |
| **TripoSplat** | 3DGS | ~24 GB `[INFERIDO]` | **MIT (comercial OK)** `[VERIFICADO]` |
| **LGM** (ECCV'24) | multi-view gaussians | media | open (verificar) `desconocido` |
| **Splatter Image** (CVPR'24) | 3DGS mono-imagen | baja | open (verificar) `desconocido` |
| **Bolt3D** (ICCV'25) | **escena 3D en segundos** | `desconocido` | `desconocido` — verificar |

- **Pros:** rotación **libre y consistente** una vez reconstruido; TRELLIS/TripoSplat con
  **licencia MIT** (ideal). Muy bueno para **objetos/props** rotables.
- **Contras:** la mayoría son **object-centric**, no **escenas de fondo** amplias; la salida es
  **3D texturizado realista**, **no line-art** → re-estilizar igualmente; Bolt3D (escena
  completa) es prometedor pero de licencia/madurez `desconocido`. `[INFERIDO]`

### Familia C — "Fake-3D" pragmático (depth-warp + re-generación con ControlNet)  ★ recomendado
No reconstruye 3D "de verdad": usa una **proxy geométrica** (depth map / malla burda /
re-proyección) para **condicionar** una difusión que **re-dibuja** la escena desde el ángulo
nuevo, en **estilo line-art**, manteniendo semilla y referencia.

Pipeline propuesto:
1. **Depth/geometría** de la imagen fuente (Depth Anything V2-Small o Marigold, Apache).
2. **Re-proyección** de la imagen + depth a la **cámara nueva** (warp por depth → produce un
   render "roto" con huecos: la proxy geométrica).
3. **Re-generación con difusión** condicionada por:
   - **ControlNet-Depth (SDXL)** con el depth de la cámara nueva (fija la perspectiva),
   - **ControlNet Line-art anime / LoRA de line-art** (fija el estilo de manga),
   - **img2img** desde el warp + **inpainting** de las zonas ocluidas,
   - **seed fija + imagen de referencia** de la fuente (coherencia de estilo/escena).
4. **Salida en capas** (línea / gris / trama) reutilizando el patrón observado en Ore-Ashi
   (capa line-art en modo *multiplicar*). `[VERIFICADO]` [caso ②](https://note.com/mazinstudio/n/ne4c3fa56b295).

Bloques con licencia comercial:

| Bloque | Opción | Licencia |
|---|---|---|
| Depth | Depth Anything V2-**Small** / Marigold | **Apache-2.0** `[VERIFICADO]` |
| Base de difusión | SDXL / Illustrious / modelo anime open | **verificar por checkpoint** (muchos permiten comercial) `desconocido` |
| ControlNet Depth | ControlNet-SDXL-Depth | open `[VERIFICADO]` [OpenLab](https://openlaboratory.com/models/control-sdxl-depth/) |
| ControlNet Line-art anime | LineartXL / kataragi / Illustrious CN | open `[VERIFICADO]` [HF](https://huggingface.co/kataragi/ControlNet-LineartXL) |

- **Pros:** **estilo line-art nativo** (es el eje de todo el negocio); **licencias limpias**;
  cabe en **24 GB**; el mismo motor sirve para F1/F2 (generación) y F5 (rotación) → **una sola
  pila de inferencia**; degrada de forma controlada (ángulo grande → más inpainting, igual que
  el comportamiento admitido por Ore-Ashi).
- **Contras:** la perspectiva es **plausible, no milimétrica** (la difusión "interpreta" la
  proxy); requiere **tuning** de ControlNets/seed; sin memoria 3D persistente entre vistas
  (cada rotación es semi-independiente) salvo que se añada una malla de anclaje.

### Familia D — Modelos comerciales vía API (comparación / fallback, no recomendación primaria)
- Novel-view / image-to-3D gestionados: **fal.ai / Replicate** exponen TRELLIS, depth, SDXL+
  ControlNet, y algunos NVS como endpoints. Útiles para **prototipar sin GPU** o como
  **overflow** de capacidad.
- Trade-off: coste unitario mayor, menos control fino de estilo, dependencia externa. Cifras
  exactas por endpoint: `desconocido` — método: consultar pricing de cada API al integrarla.
- **Descartados para el core comercial self-host** por el objetivo del proyecto, pero válidos
  como plan B de arranque.

---

## 2. Tabla comparativa

| Criterio | A. Depth→render→inpaint | B. Image-to-3D (TRELLIS) | C. Fake-3D + ControlNet ★ | D. APIs comerciales |
|---|---|---|---|---|
| Fidelidad de perspectiva | **Alta** (geométrica) en ángulo pequeño/medio | Alta (3D real) | **Media-alta** (plausible) | Variable |
| Coherencia line-art | Baja (hay que re-estilizar) | Baja (salida realista) | **Alta** (nativo) | Media |
| Rotación amplia | huecos grandes → inpaint | **libre** | degrada a más inpaint | según modelo |
| Latencia | **Baja** (1 pasada + render) | Media (~30 s) | Media (difusión + CN) | red + cola |
| Coste/render | **Muy bajo** | Bajo-medio | Bajo-medio | **Alto** |
| VRAM | ~8–10 GB | **24 GB** | ~12–16 GB (cabe en 24) | 0 local |
| Madurez | Alta | Alta (object-centric) | Alta (piezas maduras) | Alta |
| **Licencia comercial** | **OK** (V2-Small/Marigold Apache) | **OK** (MIT) | **OK** (piezas open) | según proveedor |
| Ajuste a **fondos de manga** | Bueno (escenas) | **Flojo** (objetos, no escenas) | **El mejor** | Medio |

**Modelos explícitamente descartados por licencia:** **Stable Virtual Camera (SEVA)** —
*Non-Commercial License* `[VERIFICADO]` [LICENSE](https://github.com/Stability-AI/stable-virtual-camera/blob/main/LICENSE);
**CAT3D** — cerrado, sin pesos públicos (Google) `[INFERIDO]`. Son técnicamente los mejores en
NVS puro, pero **no usables en un producto comercial**.

---

## 3. Recomendación fundamentada (self-host, comercial, line-art)

**Arquitectura de inferencia recomendada = C como núcleo, con A como acelerador geométrico y
B reservado a props.**

1. **Núcleo de rotación (F5):** Fake-3D = *Depth Anything V2-Small/Marigold → warp a cámara
   nueva → SDXL(anime) + ControlNet-Depth + ControlNet-Lineart + img2img/inpaint con seed +
   referencia*. Licencias Apache/MIT/open, cabe en 24 GB, produce line-art nativo.
2. **Acelerador de perspectiva (opcional):** usar **MoGe/DA3** para obtener point-map/normales
   y generar una **proxy geométrica más fiel** que el simple depth-warp (mejora ángulos medios),
   *condicionado a confirmar su licencia comercial*.
3. **Props rotables (小物):** **TRELLIS (MIT)** para generar un activo 3D real cuando el usuario
   quiera girar un objeto 360°; luego re-estilizar a line-art con el mismo motor de C.
4. **Fallback de arranque:** exponer C sobre **fal.ai/Replicate** para el primer prototipo sin
   comprar/alquilar GPU, y migrar a self-host cuando se valide.

**Por qué C y no A/B puros:** el producto **vive del line-art coherente**, no de un 3D realista;
A y B dan geometría pero salida realista que igual hay que re-dibujar. C **integra la
re-estilización en el mismo paso** que la rotación, con licencias limpias y una sola pila.

---

## 4. ¿Qué usa probablemente Ore-Ashi?  (hipótesis explícita)

`[INFERIDO]` — no hay fuente pública que confirme su stack (`01 §8`). Basado en el comportamiento
observado:

- La combinación **"rota bien en ángulos moderados + inventa zonas ocluidas en ángulos grandes +
  workaround por prompt + detalle alto = artefactos"** encaja con un **re-render generativo tipo
  Familia A/C** (depth-warp + inpainting/difusión), **no** con una reconstrucción 3D exacta ni con
  splatting persistente (que no "inventaría" de forma tan dependiente del prompt).
- El hecho de que el **prompt** ayude a fijar el ángulo sugiere un **modelo de difusión
  condicionado a texto + cámara** en el lazo (no una cámara puramente geométrica).
- La salida en **line-art por capas** sugiere que el motor de rotación **comparte el modelo de
  estilo** con la generación normal (una sola pila), como en la recomendación C.
- **Modelo base concreto: desconocido.** Método para acotar: (a) inspeccionar en DevTools con
  cuenta propia los tiempos/artefactos y payloads; (b) tests A/B de ángulo para ver si la
  perspectiva es geométrica exacta (→ A) o plausible (→ C); (c) revisar futuros posts de
  note.com/mazinstudio.

> **Conclusión honesta:** es plausible `[INFERIDO]` que Ore-Ashi use un **depth/geometry-warp +
> difusión de re-render con ControlNet-like y estilo line-art propio**, posiblemente con un
> modelo fine-tuneado interno. No se puede afirmar el modelo exacto sin acceso interno, y **no
> es necesario**: la Familia C reproduce el mismo *qué* y *cómo* con tecnología abierta y
> licencia comercial.

---

## 5. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Perspectiva "plausible" pero no exacta (C) | añadir proxy MoGe/DA3; limitar rango de ángulo por UI (como hace Ore-Ashi) |
| Huecos de des-oclusión feos | inpainting con contexto + referencia de estilo; permitir corrección manual (F6) |
| Deriva de estilo entre vistas | seed fija + imagen de referencia + LoRA de estilo consistente |
| Licencia de depth (solo V2-Small es Apache) | usar **V2-Small** o **Marigold**; evitar Base/Large/Giant (CC-BY-NC) |
| Licencia MoGe/DA3/Bolt3D sin confirmar | **verificar repo antes de usar en prod**; si NC, sustituir por V2-Small/Marigold |
| VRAM en picos (novel-view pesado) | 24 GB cubre C; reservar A100 solo si se mide falta |

---

## 6. Resumen ejecutivo de Fase 3

- El problema **no tiene solución geométrica exacta desde 1 imagen**: siempre hay que
  **alucinar lo ocluido**; el comportamiento público de Ore-Ashi confirma que ellos también.
- Los **mejores modelos de NVS puro (Stable Virtual Camera, CAT3D) NO son comercialmente
  usables** → decisión de arquitectura forzada hacia piezas open con licencia limpia.
- **Recomendación: Familia C "Fake-3D"** (depth-warp + ControlNet-Depth + line-art anime +
  seed/referencia + inpaint), con **A** como acelerador geométrico opcional (MoGe/DA3, licencia
  a confirmar) y **TRELLIS (MIT)** para props 360°. Todo en **24 GB**, licencias **Apache/MIT/open**.
- **Hipótesis sobre Ore-Ashi `[INFERIDO]`:** depth/geometry-warp + difusión de re-render con
  estilo line-art propio; modelo exacto **desconocido** e innecesario para replicar el valor.

**Siguiente fase:** `04-arquitectura.md` — MI sistema (front/back/cola/storage/auth/créditos),
contratos de API, dónde corre cada modelo y estimación de costo por generación y por rotación.
