# Exploration: machine-ingest (ingesta, extracción y transcripción)

Fecha: 2026-09-02. Change abierto tras completar la fase Discovery.

## 0. Fuentes consultadas (verificación real, no memoria)

Todo lo de abajo se comprobó leyendo el código del repositorio en este commit, no de memoria:

- `packages/node/machine-core/src/index.ts` — firma y cuerpo de `machine_process_input`.
- `tools/build-registry/src/index.ts` — qué archivos entran en el catálogo (`INSTALLABLE_DIRS`).
- `cli/src/commands/install.ts` — qué hace el instalador con el campo `runtime`.
- `tools/convert-inputs/` — extracción de documentos ya implementada y verificada.
- `packages/py/` — contenido actual del directorio.

## 1. Estado actual

### 1.1 Lo que existe y funciona

`machine_process_input` es un **guardián**, no un ingestor. Recibe `{ projectDir, inputPath,
content, route, outputPath }` **ya resueltos** y hace tres cosas bien:

1. Calcula el `sha256` del contenido.
2. Decide idempotencia con `isProcessed`: un insumo ya procesado se salta.
3. Registra el insumo en el estado con su `route` y su `outputPath`.

También detecta audio por extensión (`AUDIO_EXTENSION_PATTERN`, seis formatos) y marca
`NEEDS INPUT` cuando no hay transcripción ni proveedor. El contrato **ya acepta**
`transcription` y `transcriptionProvider`: el hueco está señalizado desde el diseño original.

`tools/convert-inputs/` convierte documentos a Markdown y está verificado con binarios reales
(PDF, DOCX, XLSX, PPTX, HTML, CSV). Es idempotente por contenido y reporta `empty` cuando un
insumo no aporta texto.

### 1.2 Lo que no existe

Nadie enumera `docs/<proyecto>/inputs/`. Nadie clasifica un insumo como `business` o `discovery`.
Nadie escribe el registro Markdown de cada insumo ni el `inputs/index.md` que la spec de
`machine-core` menciona. El pipeline es demostrable con argumentos inyectados, pero **un usuario
no puede soltar archivos en `inputs/` y ejecutar el comando**.

## 2. Gaps

### 2.1 El código ejecutable de un paquete no se distribuye — GAP BLOQUEANTE

Es el hallazgo más importante de esta exploración, y no estaba en el inventario previo.

`INSTALLABLE_DIRS` es `["commands", "agents", "skills", "templates"]`. El `src/` de un paquete
**no entra en el catálogo y no se instala**. El instalador, además, **no lee el campo `runtime`**:
lo copia todo igual, sea Node o Python.

Hoy no se nota porque los paquetes Node existentes funcionan dentro de este clon del repositorio,
donde el `src/` ya está. Pero significa que **un paquete Python en `packages/py/` no tiene forma
de que su código llegue al usuario**. Poner ahí la extracción o la transcripción no las hace
instalables por sí solo.

Esto ata `machine-ingest` al punto de distribución: hasta que se decida cómo viaja el código
ejecutable, un paquete Python es una carpeta que nadie puede instalar.

### 2.2 Clasificación business/discovery — GAP DE DISEÑO

La heurística de clasificación es, según `tasks.md` del change anterior, responsabilidad de
`machine-core`. Pero clasificar el contenido de un insumo **no es determinista**: es una lectura
semántica. Cae en el mismo límite ya documentado para la síntesis.

La consecuencia práctica: la parte determinista (enumerar, hashear, decidir si ya se procesó,
escribir el registro) puede y debe vivir en el tool; la decisión de ruta no puede garantizarse por
código. Un insumo sin clasificación clara debe quedar `NEEDS INPUT`, no recibir una ruta
arbitraria.

### 2.3 Transcripción de audio — GAP REAL

No hay proveedor, ni motor local, ni FFmpeg. `markitdown[all]` instaló `pydub` y
`speechrecognition`, pero **sin FFmpeg no funcionan**: al correr los tests, `pydub` avisa de su
ausencia. El audio es el insumo principal de una reunión, así que este gap no es marginal.

### 2.4 Imágenes y PDF escaneado

Verificado al construir `convert-inputs`: sin `llm_client`, MarkItDown solo lee metadatos de una
imagen, así que una foto de pizarra devuelve vacío. Un PDF escaneado cae en lo mismo. Hace falta
OCR o un modelo de visión, y ninguno está resuelto.

## 3. Preguntas abiertas (requieren decisión del usuario)

Ninguna de estas puede decidirse desde el código; todas cambian el diseño.

1. **Proveedor de transcripción.** La propuesta original decidió «API de proveedor configurable
   con override local». Falta elegir el proveedor concreto y cómo se configura su credencial,
   sabiendo que una API key no puede vivir en el repositorio.
2. **FFmpeg: ¿se vendoriza como Pandoc?** Pandoc vive en el `.venv` vía `pypandoc-binary` y la
   convención dice que no debe instalarse en el sistema. FFmpeg es bastante más pesado. La
   alternativa es delegar el audio en una API que acepte el archivo tal cual, sin conversión
   local, y no vendorizar nada.
3. **¿Cómo se distribuye el código ejecutable de un paquete?** (gap 2.1). Sin esto, `packages/py`
   no puede alojar nada instalable. Está entrelazado con la decisión pendiente de dónde se
   publica el marketplace.
4. **OCR de imágenes y PDF escaneado: ¿entra en el alcance o se difiere?** Recomendación:
   diferirlo. Marcar el insumo `NEEDS INPUT` es un resultado honesto y ya está soportado.

## 4. Approaches evaluados

### A. Todo en un paquete Python nuevo

Extracción, transcripción e ingesta en `packages/py/machine-ingest`. Coherente con la
reestructuración node/py, pero **bloqueado por 2.1**: hoy sería un paquete no instalable. Además
mete la enumeración y el registro —que son deterministas y ya tienen su sitio— fuera de
`machine-core`.

### B. Ingesta en `machine-core`, extracción y transcripción como herramientas externas

La parte determinista (enumerar, hashear, registrar, escribir el índice) crece dentro de
`machine-core`, que ya es dueño del estado. La extracción sigue donde está y la transcripción se
suma como herramienta. No desbloquea `packages/py`, pero **no depende de 2.1 para entregar
valor**: el usuario ya podría soltar documentos en `inputs/` y ejecutar el comando.

### C. Secuencial: primero la ingesta, después los paquetes Python

B como primera entrega, y los paquetes Python cuando se resuelvan las decisiones 1, 2 y 3.

## 5. Recomendación

**Approach C.** La razón es que el valor y el bloqueo están separados:

- Lo que **desbloquea al usuario** —enumerar `inputs/`, hashear, clasificar con `NEEDS INPUT`
  cuando no hay certeza, escribir el registro y el índice— es determinista, cabe en
  `machine-core` y **no depende de ninguna decisión pendiente**.
- Lo que **sí depende** de decisiones —transcripción, FFmpeg, empaquetado Python— puede esperar
  sin bloquear lo anterior, porque el estado ya sabe representar un insumo pendiente
  (`NEEDS INPUT`) y el contrato ya acepta `transcriptionProvider`.

Ordenar al revés dejaría el change parado en las preguntas abiertas sin entregar nada.

## 6. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Enumerar archivos rompe la idempotencia si el hash cambia por reconversión | Alto | Hashear el **insumo original**, no su conversión a Markdown |
| La clasificación automática asigna rutas erróneas | Alto | `NEEDS INPUT` ante la duda; la ruta la confirma un humano |
| `packages/py` sigue vacío tras el change | Medio | Asumido y explícito: depende de decisiones abiertas |
| El insumo privado `posted*` acaba versionado | Alto | Ya cubierto por `.gitignore`; los tests no deben crear insumos con ese prefijo |

## 7. ¿Listo para propuesta?

Sí, para el alcance del approach C. Las preguntas 1, 2 y 3 quedan abiertas y **no bloquean** la
primera fase; sí bloquean la segunda, y la propuesta lo refleja.
