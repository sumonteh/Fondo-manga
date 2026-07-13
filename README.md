# Fondo Manga v5

Fondo Manga v5 transforma fotografías o renders 3D en bases de dibujo manga en blanco y negro desde el navegador. La versión v5 prioriza una interpretación lineal y editable: menos masas negras, más estructura arquitectónica, línea principal/secundaria/detalle fino separados y exportación por capas para continuar el trabajo en Clip Studio Paint o a mano.

## Objetivos

- Conservar perspectiva y geometría de la imagen de origen.
- Reducir ruido fotográfico antes de extraer líneas.
- Separar líneas principales, secundarias y detalle fino.
- Reservar blancos en cielos y superficies claras.
- Agrupar sombras en masas negras configurables.
- Limitar la cobertura de negro para que la arquitectura no colapse.
- Aplicar tramas solo en zonas donde aporten lectura gráfica.
- Exportar resultados por capas para edición posterior.

## Privacidad

La imagen se procesa en el dispositivo del usuario. No se sube a servidores externos y no se guarda automáticamente en `localStorage`. Solo se guardan ajustes y presets personalizados.

## Funcionamiento

1. `index.html` carga la interfaz estática.
2. `js/app.js` coordina carga de imagen, estado, previews y exportación.
3. `js/worker.js` recibe `ImageData` y ejecuta el pipeline en segundo plano.
4. El renderer modular ejecuta etapas explícitas:
   - preparación con valor, brillo, contraste, niveles, puntos negro/blanco y gamma;
   - máscaras heurísticas de cielo, arquitectura, agua, vegetación, luces y sombras;
   - extracción multiescala de línea principal, secundaria y detalle fino;
   - limpieza morfológica, conexión de huecos y preservación geométrica;
   - tonos suaves, sombras profundas y negros sólidos como capas distintas;
   - composición y exportación de capas.

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
│       ├── line-cleanup.js
│       ├── manga-renderer.js
│       ├── preprocess.js
│       ├── regions.js
│       ├── textures.js
│       └── tones.js
├── assets/
└── README.md
```

## Uso

Abre `index.html` desde un servidor estático, carga una imagen JPG, PNG o WebP y recorre las pestañas numeradas. El selector **Capa** permite inspeccionar preparación, líneas, sombras y máscaras antes de exportar.

## GitHub Pages

El proyecto no requiere build, backend ni variables de entorno. Para publicarlo:

1. En GitHub, abre **Settings > Pages**.
2. Selecciona deploy desde una rama.
3. Usa `main` y carpeta `/root` cuando la versión esté fusionada.

Mientras se revisa la v5, se puede probar desde la rama `codex/fondo-manga-v5`.

## Formatos disponibles

- Web: lado mayor de 2000 px.
- A5: 300, 450 y 600 dpi.
- A4: 300, 450 y 600 dpi.

600 dpi aparece como alta resolución y muestra estimación de dimensiones y memoria. La app renderiza directamente al tamaño final seleccionado, sin escalar desde 300 dpi. A4 600 dpi puede superar la memoria disponible según la proporción de la imagen; en ese caso la app muestra un mensaje con alternativas como A5 600 dpi, A4 450 dpi o A4 300 dpi.

## Controles principales

- Tipo de escena: urbano, interior, vegetación, ribera o general.
- Valor: desplaza la interpretación tonal antes de líneas y sombras.
- Brillo: aclara u oscurece luminancia general.
- Contraste: separa tonos y afecta detección de líneas.
- Punto negro, punto blanco y gamma: controlan niveles antes de cualquier extracción.
- Mezcla blanco y negro: ajusta la conversión perceptual a grises.
- Detalle: cantidad general de línea fina.
- Limpieza: reducción de ruido y eliminación de pequeñas marcas.
- Simplificación y conexión: eliminan segmentos irrelevantes y unen huecos pequeños.
- Línea principal: intensidad y grosor de contornos/siluetas.
- Línea secundaria: intensidad y grosor de divisiones internas, molduras, ventanas y estructura media.
- Detalle fino: intensidad y grosor de microdetalle opcional.
- Reserva de blanco: protege cielos y superficies claras.
- Masas negras: fuerza de sombras sólidas.
- Cobertura de negro: límite aproximado de píxeles que pueden convertirse en negro sólido.
- Detalle lejano: reduce información visual en el fondo.
- Suavidad tonal: evita posterización agresiva.
- Posterización y threshold: herramientas opcionales de tonos, no el centro del pipeline.
- Compresión de negros: lleva sombras hacia grises para evitar bloques empastados.
- Textura: intensidad de tramas y grano.
- Trama: puntos, líneas, cruzada, orgánica, concreto, vegetal o ninguna.

## Presets

- Flujo tipo Clip Studio (modo principal por etapas).
- Base para entintado.
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
├── 02_linea-principal.png
├── 03_linea-secundaria.png
├── 04_detalle-fino.png
├── 05_sombras.png
├── 06_masas-negras.png
├── 07_tonos.png
├── 08_texturas.png
├── 09_boceto-azul.png
├── 10_original-ajustado.png
├── 11_mascara-cielo.png
├── 12_mascara-arquitectura.png
├── 13_mascara-agua.png
└── configuracion.json
```

Las capas de línea principal, línea secundaria, detalle fino, masas negras, texturas y boceto azul conservan transparencia.

## Compatibilidad

Diseñado para Chrome, Edge, Safari y Firefox recientes. Requiere soporte de Canvas, Web Workers, módulos ES y APIs modernas de descarga. `OffscreenCanvas` se detecta cuando está disponible, pero la v5 incluye fallback basado en `ImageData`.

## Limitaciones

- La detección de cielo, arquitectura, vegetación, agua y profundidad es heurística; los controles de influencia permiten corregir su alcance, pero todavía no existe pintura manual de máscaras por pincel.
- La exportación A4 600 dpi puede ser demasiado pesada en móviles o imágenes casi cuadradas; la app bloquea tamaños estimados excesivos y sugiere alternativas.
- La clasificación de ventanas, fachadas y detalles repetitivos todavía es aproximada.
- El ZIP usa almacenamiento sin compresión para evitar dependencias externas.
- OffscreenCanvas se detecta, pero la ruta actual usa `ImageData` en Worker como fallback universal; el empaquetado PNG se hace en el hilo principal.

## Hoja de ruta

- Procesamiento por bloques reales para exportaciones muy grandes.
- Pintura manual de máscaras para cielo, vegetación y primer plano.
- Mejora de continuidad de líneas arquitectónicas.
- Previsualización progresiva mientras se arrastran sliders.
- Suite de pruebas visuales con imágenes de referencia.

## Bibliotecas

No se usan bibliotecas externas en la v5 inicial.

## Licencia

Pendiente de definir.
