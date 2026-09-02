# Propuesta: machine-ingest (ingesta de insumos)

Change abierto el 2026-09-02, después de completar las fases Business y Discovery.

## Resumen

Cerrar el hueco que impide usar el pipeline de verdad: hoy `machine_process_input` recibe el
contenido, la ruta y el destino **ya resueltos**, así que nadie enumera `docs/<proyecto>/inputs/`
ni clasifica lo que hay dentro. Esta propuesta hace que un usuario pueda soltar archivos en
`inputs/`, ejecutar un comando y obtener sus insumos registrados, convertidos a Markdown y
enrutados —o marcados `NEEDS INPUT` cuando no haya certeza.

## Motivación

Las fases Business y Discovery están completas y verdes, pero ambas parten de insumos ya
procesados. El pipeline es demostrable con argumentos inyectados y **no utilizable por una
persona**. Es el último eslabón que separa lo construido de un producto que alguien pueda correr.

La extracción de documentos ya existe y está verificada (`tools/convert-inputs/`); lo que falta es
quien enumere, clasifique y registre.

## Alcance

### Entra

- Enumeración de `docs/<proyecto>/inputs/`, recursiva y con orden estable.
- Idempotencia por `sha256` del **insumo original**, reutilizando `isProcessed`/`upsertInput`.
- Conversión a Markdown de los formatos ya soportados, reutilizando la extracción existente.
- Registro Markdown por insumo bajo la ruta que le corresponda, y un `inputs/index.md` legible.
- Clasificación `business` / `discovery`, con `NEEDS INPUT` obligatorio ante cualquier duda.
- Un comando que orqueste todo lo anterior sobre un proyecto.

### No entra (y por qué)

- **Transcripción de audio**: depende de decidir proveedor y qué hacer con FFmpeg. El estado ya
  representa el insumo pendiente y el contrato ya acepta `transcriptionProvider`.
- **OCR de imágenes y PDF escaneado**: sin resolver y caro; `NEEDS INPUT` es un resultado honesto.
- **Paquetes en `packages/py/`**: bloqueado, ver «Precondición no resuelta».
- **Distribución remota**: es otro change.

## Precondición no resuelta: el código ejecutable no se distribuye

`INSTALLABLE_DIRS` es `["commands", "agents", "skills", "templates"]`: el `src/` de un paquete no
entra en el catálogo ni se instala, y el instalador **no lee `runtime`**. Hoy no se nota porque
los paquetes Node funcionan dentro de este clon, pero implica que **un paquete Python no tiene
forma de llegar al usuario**.

Consecuencia asumida: esta propuesta **no crea paquetes en `packages/py/`**. La ingesta crece en
`machine-core`, que ya es dueño del estado y del hash, y la extracción sigue como herramienta del
repositorio. `packages/py` seguirá vacío al cerrar el change, y eso es deliberado, no un olvido.

## Fases de entrega

### 1. Enumeración e índice (sin dependencias abiertas)

Enumerar `inputs/` con orden estable, hashear cada insumo original, saltar los ya procesados y
escribir `inputs/index.md`. Todo determinista, todo con TDD.

### 2. Conversión de insumos

Conectar la extracción existente para que un `.docx` o un `.pdf` en `inputs/` produzca su registro
Markdown. Un insumo sin texto extraíble se registra como `NEEDS INPUT`, sin dejar archivos vacíos.

### 3. Clasificación y enrutado

Asignar `route` a cada insumo. La parte determinista (registrar, escribir, decidir destino según
la ruta) va en el tool; la lectura semántica que propone la ruta vive en el prompt del agente, y
**todo insumo sin clasificación clara queda `NEEDS INPUT`**.

### 4. Comando y agente

El comando que orquesta la ingesta sobre un proyecto, con el mismo patrón del resto: `.md`
declarativo, tool determinista, sin `bash` ni `edit` en el agente.

### 5. Diferido hasta que haya decisiones

Transcripción de audio, OCR y el empaquetado Python. Cada uno arranca cuando su decisión esté
tomada.

## Paquetes y módulos afectados

| Módulo | Cambio |
|---|---|
| `packages/node/machine-core` | Crece con la enumeración, el índice y el registro de insumos |
| `packages/node/machine-core/commands` | Comando nuevo de ingesta |
| `tools/convert-inputs` | Se consume desde el pipeline; puede necesitar una interfaz estable |
| `registry/index.json` | Se regenera al declarar el comando nuevo |
| `openspec/changes/machine-ingest` | Artefactos de este change |

## Decisiones y supuestos

- **DECIDIDO**: la ingesta vive en `machine-core`, no en un paquete nuevo. Ya es dueño del estado,
  del hash y de las puertas; separarla obligaría a duplicar o exponer ese estado.
- **DECIDIDO**: el `sha256` se calcula sobre el **insumo original**, nunca sobre su conversión a
  Markdown. Si se hashease la conversión, mejorar el conversor invalidaría insumos ya procesados y
  rompería la idempotencia.
- **DECIDIDO**: ante cualquier duda de clasificación, `NEEDS INPUT`. Nunca una ruta arbitraria.
- **SUPUESTO**: la interfaz actual de `tools/convert-inputs` sirve para consumirse desde el
  pipeline sin reescribirla. A confirmar en el diseño.
- **ABIERTO**: proveedor de transcripción, FFmpeg, y cómo se distribuye el código ejecutable.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Hashear la conversión en vez del original rompe la idempotencia | Decisión explícita arriba, y un test que lo fije |
| La clasificación automática asigna rutas erróneas en silencio | `NEEDS INPUT` por defecto; la ruta la confirma un humano |
| Reprocesar un `inputs/` grande es lento | `isProcessed` ya salta lo conocido; enumerar es barato frente a convertir |
| Un insumo privado `posted*` se versiona | Cubierto por `.gitignore`; ningún test debe crear insumos con ese prefijo |
| `machine-core` se vuelve un cajón de sastre | Módulos separados dentro del paquete, como ya se hizo con estado, hash y puertas |

## Alternativas descartadas

- **Un paquete `packages/py/machine-ingest`**: bloqueado por la precondición; sería un paquete que
  nadie puede instalar, y sacaría de `machine-core` lógica determinista que le pertenece.
- **Resolver primero transcripción y OCR**: dejaría el change parado en decisiones abiertas sin
  entregar nada utilizable.
- **Que el agente enumere el directorio y llame al tool archivo por archivo**: mueve al prompt algo
  determinista, y con ello se pierde la garantía de idempotencia.

## Plan de reversión

Cada fase es un commit propio detrás de un comando nuevo; ninguna modifica el comportamiento
existente de `machine_process_input`, que conserva su firma. Revertir el commit devuelve el
pipeline al estado actual, en el que los argumentos se inyectan. El estado en disco es compatible:
los insumos registrados por la ingesta tienen la misma forma que los inyectados a mano.

## Criterio de salida de esta propuesta

Un usuario deja documentos en `docs/<proyecto>/inputs/`, ejecuta el comando de ingesta y obtiene:
sus insumos registrados en el estado con su hash, convertidos a Markdown donde se pueda, un
`inputs/index.md` legible, y todo lo que no se pudo resolver marcado `NEEDS INPUT` en vez de
adivinado. El audio queda pendiente y señalizado.
