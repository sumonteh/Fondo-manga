# 01 — Recon público de Ore-Ashi (俺アシ)

> **Objetivo del documento:** mapear la superficie pública de
> [ore-ashi.com](https://ore-ashi.com) (俺アシ / Mazin Studio) para entender el
> QUÉ y el CÓMO conceptual, sin acceder a nada tras login ni copiar assets/prompts.
>
> **Convención de rigor:**
> `[VERIFICADO]` = visto en web/documentación pública (con URL). ·
> `[INFERIDO]` = deducción propia. ·
> `desconocido` = no confirmado + método propuesto para averiguarlo.
>
> **Fecha del recon:** 2026-07-24.

---

## 0. Nota de método (limitación técnica encontrada)

- `ore-ashi.com` y `note.com` devuelven **HTTP 403 a peticiones automatizadas**
  (WebFetch), por protección anti-bot. `[VERIFICADO]` (respuesta 403 reproducida).
- La extracción de contenido **sí funciona vía búsqueda web** (snippets indexados de
  los artículos de note.com y de las rutas `/pricing`, `/faq`). Todo lo de este doc
  proviene de esa vía o del propio repo.
- **Lo que solo es observable desde un navegador con sesión propia** (DevTools →
  pestañas Network/Sources: framework JS exacto, nombres de endpoints internos, CDN
  de imágenes, proveedor de pagos, cola de jobs) queda marcado como `desconocido` con
  el método para obtenerlo. **No se inventan** endpoints, modelos ni precios.

---

## 1. Identidad del producto

| Campo | Valor | Rigor |
|---|---|---|
| Nombre corto | 俺アシ (Ore-Ashi) | `[VERIFICADO]` [ore-ashi.com/pricing](https://ore-ashi.com/pricing) |
| Nombre largo | 「俺のAIアシスタントが有能すぎて背景モブ小物を全部やってくれる件」 ("Mi asistente de IA es tan capaz que me hace todos los fondos, mobs y props") | `[VERIFICADO]` [ore-ashi.com](https://ore-ashi.com/pricing) |
| Empresa | 株式会社マジンスタジオ (Mazin Studio, Inc.) | `[VERIFICADO]` [note.com/mazinstudio](https://note.com/mazinstudio/n/n38f79dfa47c0) |
| Fundador / CEO | ひるま (@maruhi_dd) | `[VERIFICADO]` [x.com/maruhi_dd](https://x.com/maruhi_dd/status/2031280066991370571) |
| Categoría | Web app de IA generativa para producción de manga: **fondos (背景), props/objetos (小物) y mobs (モブ)** | `[VERIFICADO]` [note.com manual](https://note.com/mazinstudio/n/n6bb007e1a4b4) |
| Propuesta de valor | Reemplazar el trabajo de asistente de manga (背景/モブ/小物) generando line-art coherente con perspectiva a partir de prompt/nemu | `[VERIFICADO]` [note.com](https://note.com/mazinstudio/n/n38f79dfa47c0) |
| Producto hermano | 「マジンスタジオ」: herramienta de pintura AI "next-gen Clip Studio" (beta separada, mismo autor) | `[VERIFICADO]` [x.com/maruhi_dd](https://x.com/maruhi_dd/status/1885865591489364019) |

**Impacto reportado (casos de uso oficiales):** reducción de tiempo de fondos de
~60–90 min a ~30 min (≈70% menos) / "1/3 del tiempo". `[VERIFICADO]`
[caso ①](https://note.com/mazinstudio/n/n37ff6755d668),
[caso ②](https://note.com/mazinstudio/n/ne4c3fa56b295).

---

## 2. Feature crítica: 「1枚絵ロケ」 (Single Image Location) — imagen → mundo 3D

Esta es la función que motiva todo el proyecto. Lo que dice la documentación pública:

- **Qué hace:** convierte **una sola imagen de fondo en un "mundo 3D"** que se puede
  explorar moviendo la cámara para capturar la misma escena desde otros ángulos.
  `[VERIFICADO]` [WebSearch de note.com](https://note.com/mazinstudio/n/n6bb007e1a4b4).
- **Nombre oficial:** 「1枚絵ロケ」 (lit. "location scouting con una sola ilustración").
  `[VERIFICADO]`.
- **Flujo declarado:** cargar la imagen de fondo a rotar → fijar el ángulo deseado en
  los ajustes de cámara → generar la salida. `[VERIFICADO]`.
- **Limitaciones reconocidas por el fabricante** (muy informativas para replicar):
  - Funciona bien con **rotaciones moderadas**; en **rotaciones grandes genera zonas
    que no existían** en la imagen original (alucinación de lo ocluido). `[VERIFICADO]`.
  - Workaround sugerido: cuando la rotación no sale bien, **especificar el ángulo por
    prompt y regenerar**. `[VERIFICADO]`.
  - Imágenes con **mucho detalle/objetos** quedan con imperfecciones tras rotar →
    requieren **corrección manual** o aceptar compromiso. `[VERIFICADO]`.

> **Lectura de ingeniería `[INFERIDO]`:** el comportamiento descrito (bien en ángulos
> pequeños, invención de zonas ocluidas en ángulos grandes, dependencia de prompt para
> ángulos fuertes) es coherente con un pipeline de **novel-view synthesis / re-render
> con relleno generativo**, no con una reconstrucción 3D geométrica exacta. Se analiza
> a fondo en `03-pipeline-3d.md`.

---

## 3. Inputs del usuario

| Input | Detalle | Rigor |
|---|---|---|
| Prompt en lenguaje natural | Se instruye "como a un asistente"; iteración conversacional hacia el material ideal | `[VERIFICADO]` [manual](https://note.com/mazinstudio/n/n6bb007e1a4b4) |
| ネーム (nemu / storyboard) | Genera line-art con perspectiva a partir del boceto de página; ahorra reglas de perspectiva + entintado | `[VERIFICADO]` [caso ①](https://note.com/mazinstudio/n/n37ff6755d668) |
| Boceto rough | Usado como base para line-art + coloreado (≈70% menos tiempo) | `[VERIFICADO]` [WebSearch note.com](https://note.com/mazinstudio/n/n6bb007e1a4b4) |
| Imagen de referencia (参照画像) | Parámetro de control expuesto en la UI | `[VERIFICADO]` [WebSearch /pricing+manual](https://note.com/mazinstudio/n/n6bb007e1a4b4) |
| Imagen a rotar (1枚絵ロケ) | Entrada específica de la feature 3D | `[VERIFICADO]` (§2) |

---

## 4. Parámetros de control expuestos

| Parámetro | Valores conocidos | Rigor |
|---|---|---|
| デフォルメ度 (grado de deformación/estilo) | escalar de estilo | `[VERIFICADO]` [WebSearch /pricing](https://note.com/mazinstudio/n/n6bb007e1a4b4) |
| アスペクト比 (aspect ratio) | ajustable; recomiendan evitar estirado horizontal | `[VERIFICADO]` [caso ②](https://note.com/mazinstudio/n/ne4c3fa56b295) |
| Estilo de salida | 線画 (line art) · 線画＋グレー (línea+gris) · 線画＋トーン (línea+trama/screentone) | `[VERIFICADO]` [manual](https://note.com/mazinstudio/n/n6bb007e1a4b4), [ejemplo X](https://x.com/Iwajun211/status/2032509582929727823) |
| Tipo de objeto | 背景 (fondo) · 小物 (prop) · モブ (mob) | `[VERIFICADO]` [manual](https://note.com/mazinstudio/n/n6bb007e1a4b4) |
| Resolución | 1K / 2K / 4K (2K recomendado para más detalle de fondo) | `[VERIFICADO]` [caso ②](https://note.com/mazinstudio/n/ne4c3fa56b295) + [/pricing](https://ore-ashi.com/pricing) |
| Nº de variantes | recomiendan generar **2+** simultáneas para comparar composición/detalle | `[VERIFICADO]` [WebSearch /pricing](https://ore-ashi.com/pricing) |
| Cámara / ángulo (1枚絵ロケ) | ajuste de ángulo de cámara para la rotación | `[VERIFICADO]` (§2) |

**Truco documentado (revela detalle de pipeline):** cuando la salida es en gris,
superponer una capa de line-art monocromo con **modo multiplicar** endurece líneas
difusas → sugiere que **line-art y gris/trama son capas/salidas separables**.
`[VERIFICADO]` [caso ②](https://note.com/mazinstudio/n/ne4c3fa56b295). `[INFERIDO]`:
la salida podría exponerse como capas separadas (line / tono).

---

## 5. Modelo de negocio (créditos y planes)

| Elemento | Valor | Rigor |
|---|---|---|
| Modelo | **Créditos** consumidos por operación | `[VERIFICADO]` [/pricing](https://ore-ashi.com/pricing) |
| Caducidad de créditos | **Sin caducidad** | `[VERIFICADO]` [WebSearch /pricing](https://ore-ashi.com/pricing) |
| Consumo variable | Depende de **feature y calidad de salida (1K/2K/4K)** | `[VERIFICADO]` [WebSearch /pricing](https://ore-ashi.com/pricing) |
| Plan corporativo | **¥15,000/mes** (pago con tarjeta), **20,000 créditos/mes**, créditos compartidos por organización, **SMS MFA**, audit logs, export de datos | `[VERIFICADO]` [WebSearch /pricing](https://ore-ashi.com/pricing) |
| Planes individuales (starter/light, free trial) | cifras exactas **desconocidas** | `desconocido` — método: leer `/pricing` desde navegador propio |
| Créditos por operación exactos | **desconocido** (solo se sabe que varía por calidad/feature) | `desconocido` — método: DevTools al ejecutar cada operación con cuenta propia |
| Reembolso de créditos | ante error de red / fallo de generación se puede **solicitar devolución** desde el historial del job | `[VERIFICADO]` [/faq](https://ore-ashi.com/faq) |

---

## 6. Términos de uso (relevantes para replicar el negocio)

| Punto | Contenido | Rigor |
|---|---|---|
| Copyright del output | **Pertenece a la persona que lo genera** (原則) | `[VERIFICADO]` [/faq](https://ore-ashi.com/faq) |
| Uso comercial | **Todo el output es de uso comercial** | `[VERIFICADO]` [/faq](https://ore-ashi.com/faq) |
| Salvedad | Si la **imagen de input** involucra derechos de terceros, requiere verificación individual | `[VERIFICADO]` [/faq](https://ore-ashi.com/faq) |
| Datos / entrenamiento | Imágenes subidas y prompts **excluidos del entrenamiento por defecto**; no se usan para mejorar modelos ni entrenar modelos de terceros | `[VERIFICADO]` [/faq](https://ore-ashi.com/faq) |

> **Implicación para MI producto `[INFERIDO]`:** el estándar del mercado que fija
> Ore-Ashi es "output del usuario + uso comercial + no-entrenamiento por defecto". Mi
> app debería igualar o superar esto para ser competitiva; obliga a elegir modelos con
> **licencia comercial** (ver `03`).

---

## 7. Superficie pública / rutas observadas

| Ruta | Estado | Rigor |
|---|---|---|
| `/` (landing) | existe (403 a bot; indexada) | `[VERIFICADO]` |
| `/pricing` | existe, planes y créditos | `[VERIFICADO]` [link](https://ore-ashi.com/pricing) |
| `/faq` | existe, términos/uso comercial/datos | `[VERIFICADO]` [link](https://ore-ashi.com/faq) |
| `/terms` (規約) legal completo | probable, **no confirmado** | `desconocido` — método: navegar footer del sitio |
| App / editor (tras login) | existe (producto de pago) — **fuera de alcance** por restricción de no-auth | `[INFERIDO]` |

---

## 8. Stack y proveedores de terceros (observables solo con navegador propio)

> **Ninguno confirmado** por la restricción de recon: el 403 anti-bot impide inspeccionar
> HTML/JS servido. Todo lo siguiente es `desconocido` con su método de averiguación.
> **No se ha inventado nada.**

| Aspecto | Estado | Cómo averiguarlo (método propuesto) |
|---|---|---|
| Framework front / bundler | `desconocido` | DevTools → Sources; buscar `/_next/`, `/_nuxt/`, hashes de Vite; `View Source` del HTML |
| Endpoints de API internos | `desconocido` | DevTools → Network al generar; observar rutas XHR/fetch y payloads (con cuenta propia) |
| CDN de imágenes / storage | `desconocido` | Inspeccionar `src`/headers de las imágenes generadas (dominio S3/GCS/Cloudflare R2/CDN) |
| Cola de jobs | `desconocido` | Patrón de polling/websocket en Network durante una generación |
| Auth | `desconocido` (SMS MFA existe en plan corp.) | DevTools → Network/Cookies en el login propio; cabeceras de sesión |
| Pagos | `desconocido` | DevTools en el checkout de `/pricing` (Stripe/Komoju/otros) |
| Anti-bot / edge | `[INFERIDO]` proxy tipo Cloudflare/edge WAF (por el 403 sistemático a automatización) | Revisar headers de respuesta (`server`, `cf-ray`) desde navegador |
| Modelo(s) de imagen subyacentes | `desconocido` (sin datos públicos de partnership con Stability/Imagen/etc.) | No hay fuente pública; solo inferible por comportamiento (ver `03`) |

---

## 9. Mapa de fuentes note.com/mazinstudio (para fases siguientes)

| Artículo | ID | Contenido |
|---|---|---|
| Manual oficial | [`n6bb007e1a4b4`](https://note.com/mazinstudio/n/n6bb007e1a4b4) | Inputs, parámetros, estilos de salida, tips |
| Intro / pitch | [`n38f79dfa47c0`](https://note.com/mazinstudio/n/n38f79dfa47c0) | Qué es, para quién, propuesta de valor |
| Caso de uso ① | [`n37ff6755d668`](https://note.com/mazinstudio/n/n37ff6755d668) | Workflow de fondos, "1/3 del tiempo" |
| Caso de uso ② | [`ne4c3fa56b295`](https://note.com/mazinstudio/n/ne4c3fa56b295) | Trucos de heavy-user (2K, capas gris/línea, aspect ratio) |

---

## 10. Resumen ejecutivo de Fase 1

- Ore-Ashi es una **web app de créditos** para generar **fondos/props/mobs de manga**
  en estilos **line art / línea+gris / línea+trama**, desde **prompt, nemu o boceto**,
  con controles de **deformación, aspect ratio, tipo de objeto y resolución (1K/2K/4K)**.
- Su feature diferencial es **「1枚絵ロケ」**: 1 imagen → mundo 3D → **rotar cámara** →
  nueva vista. El fabricante admite que **rota bien en ángulos moderados** y **alucina
  zonas ocluidas** en rotaciones grandes → señal fuerte de **novel-view synthesis
  generativa**, no reconstrucción geométrica exacta (se decide en `03`).
- Negocio: créditos **sin caducidad**, consumo **variable por calidad/feature**, plan
  corporativo **¥15,000/mes por 20,000 créditos**; **output del usuario + uso comercial**.
- **Huecos** (todos con método de averiguación, ninguno inventado): planes individuales
  exactos, créditos por operación, stack front, endpoints, CDN, pagos, modelo de imagen.

**Siguiente fase:** `02-features.md` — mapa funcional feature-por-feature + diagrama
Mermaid del flujo input → generación → edición → rotación → export.
