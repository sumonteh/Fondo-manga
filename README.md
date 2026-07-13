# Fondo Manga v5

Fondo Manga v5 transforma fotografías o renders 3D en fondos manga en blanco y negro desde el navegador. La versión v5 reorganiza el proyecto, mueve el procesamiento pesado a un Web Worker y produce capas separadas para líneas, masas negras, tonos, texturas, boceto azul y original ajustado.

## Objetivos

- Conservar perspectiva y geometría de la imagen de origen.
- Reducir ruido fotográfico antes de extraer líneas.
- Separar líneas principales, secundarias y detalle fino.
- Reservar blancos en cielos y superficies claras.
- Agrupar sombras en masas negras configurables.
- Aplicar tramas solo en zonas donde aporten lectura gráfica.
- Exportar resultados por capas para edición posterior.

## Privacidad

La imagen se procesa en el dispositivo del usuario. No se sube a servidores externos y no se guarda automáticamente en `localStorage`. Solo se guardan ajustes y presets personalizados.

## Funcionamiento

1. `index.html` carga la interfaz estática.
2. `js/app.js` coordina carga de imagen, estado, previews y exportación.
3. `js/worker.js` recibe `ImageData` y ejecuta el pipeline en segundo plano.
4. El renderer modular procesa:
   - escala de grises y reducción de ruido;
   - clasificación heurística de regiones;
   - líneas multiescala;
   - simplificación tonal;
   - tramas localizadas;
   - composición de capas.

## Estructura

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── export.js
│   ├── presets.js
│   ├── state.js
│   ├── ui.js
│   ├── worker.js
│   └── renderer/
│       ├── edges.js
│       ├── manga-renderer.js
│       ├── preprocess.js
│       ├── regions.js
│       ├── textures.js
│       └── tones.js
├── assets/
└── README.md
```

## Uso

Abre `index.html` desde un servidor estático, carga una imagen JPG, PNG o WebP, elige un preset y ajusta los controles principales. El comparador permite ver original y resultado con un deslizador.

## GitHub Pages

El proyecto no requiere build, backend ni variables de entorno. Para publicarlo:

1. En GitHub, abre **Settings > Pages**.
2. Selecciona deploy desde una rama.
3. Usa `main` y carpeta `/root` cuando la versión esté fusionada.

Mientras se revisa la v5, se puede probar desde la rama `codex/fondo-manga-v5`.

## Formatos disponibles

- Web: lado mayor de 2000 px.
- A5: lado mayor de 2480 px, pensado para 300 dpi.
- A4: lado mayor de 3508 px, pensado para 300 dpi.

En móviles, A4 puede superar la memoria disponible. La app avisa antes de exportar y permite cancelar el worker.

## Controles principales

- Tipo de escena: urbano, interior, vegetación, ribera o general.
- Detalle: cantidad general de línea fina.
- Limpieza: reducción de ruido y eliminación de pequeñas marcas.
- Línea principal y secundaria: jerarquía de contornos.
- Reserva de blanco: protege cielos y superficies claras.
- Masas negras: fuerza de sombras sólidas.
- Detalle lejano: reduce información visual en el fondo.
- Textura: intensidad de tramas y grano.
- Trama: puntos, líneas, cruzada, orgánica, concreto, vegetal o ninguna.

## Presets

- Urbano limpio.
- Urbano dramático.
- Seinen detallado.
- Vegetación manga.
- Ribera.
- Boceto azul.

También se pueden guardar presets personalizados en `localStorage`.

## Exportación por capas

La exportación ZIP genera:

```text
fondo-manga-proyecto.zip
├── 01_resultado-final.png
├── 02_lineas.png
├── 03_masas-negras.png
├── 04_tonos.png
├── 05_texturas.png
├── 06_original-ajustado.png
└── configuracion.json
```

Las capas de líneas, masas negras y texturas conservan transparencia.

## Compatibilidad

Diseñado para Chrome, Edge, Safari y Firefox recientes. Requiere soporte de Canvas, Web Workers, módulos ES y APIs modernas de descarga. `OffscreenCanvas` se detecta cuando está disponible, pero la v5 incluye fallback basado en `ImageData`.

## Limitaciones

- La detección de cielo, arquitectura, vegetación, agua y profundidad es heurística; no usa IA remota.
- La exportación A4 puede ser pesada en móviles de baja memoria.
- La clasificación de ventanas, fachadas y detalles repetitivos todavía es aproximada.
- El ZIP usa almacenamiento sin compresión para evitar dependencias externas.

## Hoja de ruta

- Procesamiento por bloques reales para exportaciones muy grandes.
- Máscaras manuales para cielo, vegetación y primer plano.
- Mejora de continuidad de líneas arquitectónicas.
- Previsualización progresiva mientras se arrastran sliders.
- Suite de pruebas visuales con imágenes de referencia.

## Bibliotecas

No se usan bibliotecas externas en la v5 inicial.

## Licencia

Pendiente de definir.
