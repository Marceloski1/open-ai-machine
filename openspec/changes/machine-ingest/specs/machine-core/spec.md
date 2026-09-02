# machine-core Specification (delta: machine-ingest)

## Purpose

Delta del change `machine-ingest`. Añade a `machine-core` la ingesta de insumos: enumerar
`docs/<proyecto>/inputs/`, convertir lo convertible a Markdown, registrar cada insumo y mantener
un índice legible.

No redefine lo ya especificado en `machine-core` —estado persistente, idempotencia por
content-hash, puertas humanas, invalidación aguas abajo, plantilla `.docx`—: se apoya en ello.

> Alcance deliberadamente excluido: transcripción de audio, OCR y empaquetado Python. Dependen de
> decisiones abiertas registradas en `state.yaml` de este change.

## Requirements

### Requirement: Enumeración de insumos

La ingesta MUST enumerar los archivos de `docs/<proyecto>/inputs/` de forma recursiva y en orden
estable, independiente del orden que devuelva el sistema de archivos. MUST NOT enumerar los
artefactos que ella misma genera, para no reingerir su propia salida.

#### Scenario: Insumos en subdirectorios

- GIVEN un `inputs/` con archivos en la raíz y en subdirectorios
- WHEN se ejecuta la ingesta
- THEN todos los archivos se enumeran, cualquiera sea su profundidad
- AND el orden es el mismo en dos ejecuciones sobre el mismo contenido

#### Scenario: Directorio de insumos vacío

- GIVEN un `inputs/` sin archivos
- WHEN se ejecuta la ingesta
- THEN la operación termina sin error informando que no hay insumos
- AND MUST NOT registrarse ningún insumo en el estado

### Requirement: Idempotencia sobre el insumo original

El `sha256` de cada insumo MUST calcularse sobre el **archivo original**, nunca sobre su
conversión a Markdown. Un insumo cuyo hash ya conste en el estado MUST saltarse sin reconvertirse
ni reescribir su registro.

> Razón: si el hash se calculara sobre la conversión, mejorar el conversor invalidaría insumos ya
> procesados y rompería la idempotencia que `machine-core` ya garantiza.

#### Scenario: Reejecución sin cambios

- GIVEN un `inputs/` cuyos insumos ya fueron procesados
- WHEN se ejecuta la ingesta de nuevo
- THEN todos los insumos se reportan como ya procesados
- AND MUST NOT reescribirse ningún registro

#### Scenario: El conversor cambia pero el insumo no

- GIVEN un insumo ya procesado
- WHEN la conversión a Markdown produce un texto distinto al de la vez anterior
- THEN el insumo sigue considerándose procesado, porque su archivo original no cambió

#### Scenario: Insumo modificado

- GIVEN un insumo ya procesado cuyo archivo se edita después
- WHEN se ejecuta la ingesta
- THEN el insumo se procesa de nuevo, porque su hash cambió

### Requirement: Conversión de insumos a Markdown

La ingesta MUST convertir a Markdown los formatos soportados por la extracción del repositorio y
escribir el resultado como registro del insumo. MUST NOT reimplementar la conversión.

#### Scenario: Documento convertible

- GIVEN un `.docx` en `inputs/`
- WHEN se ejecuta la ingesta
- THEN se registra su contenido convertido a Markdown

#### Scenario: Formato no soportado

- GIVEN un archivo cuyo formato la extracción no soporta
- WHEN se ejecuta la ingesta
- THEN el insumo se registra marcado `NEEDS INPUT`
- AND MUST NOT descartarse en silencio

### Requirement: Insumo sin texto extraíble

Un insumo del que no se obtenga texto —una imagen sin OCR, un PDF escaneado, un archivo vacío—
MUST registrarse marcado `NEEDS INPUT`. MUST NOT escribirse un registro vacío que aparente
contenido.

#### Scenario: Fotografía de pizarra

- GIVEN una imagen sin metadatos en `inputs/`
- WHEN se ejecuta la ingesta
- THEN el insumo queda marcado `NEEDS INPUT`
- AND MUST NOT quedar un registro Markdown vacío

### Requirement: Insumo de audio

Mientras no exista transcripción, un insumo de audio MUST registrarse marcado `NEEDS INPUT`,
conforme al comportamiento que `machine-core` ya especifica. La ingesta MUST NOT omitirlo de la
enumeración ni del índice.

#### Scenario: Grabación de reunión

- GIVEN un `.mp3` en `inputs/`
- WHEN se ejecuta la ingesta sin transcripción ni proveedor
- THEN el insumo aparece en el índice marcado `NEEDS INPUT`

### Requirement: Clasificación de la ruta

Cada insumo MUST recibir una `route` con valor `business` o `discovery`, o quedar marcado
`NEEDS INPUT` cuando su contenido no permita decidirla. MUST NOT asignarse una `route` arbitraria
para poder continuar.

> La lectura semántica que propone la ruta no es determinista y vive en el prompt del agente; lo
> que el tool garantiza es que una ruta ausente o no reconocida termina en `NEEDS INPUT`.

#### Scenario: Ruta no reconocida

- GIVEN un insumo al que se propone una `route` que no es `business` ni `discovery`
- WHEN se registra el insumo
- THEN la operación MUST rechazarse indicando el valor recibido
- AND MUST NOT registrarse el insumo con una ruta inventada

#### Scenario: Insumo ambiguo

- GIVEN un insumo cuyo contenido no permite clasificarlo
- WHEN se ejecuta la ingesta
- THEN el insumo queda marcado `NEEDS INPUT`
- AND puede clasificarse más tarde sin reprocesar los demás

### Requirement: Índice de insumos

La ingesta MUST mantener `docs/<proyecto>/inputs/index.md` con una entrada por insumo registrado,
indicando su ruta asignada y si quedó `NEEDS INPUT`. El índice MUST reflejar el estado, de modo
que regenerarlo sobre el mismo estado produzca el mismo contenido.

#### Scenario: Índice tras una ingesta parcial

- GIVEN una ingesta donde un insumo quedó `NEEDS INPUT` y otro se clasificó
- WHEN se consulta `inputs/index.md`
- THEN ambos aparecen, y el pendiente se distingue del clasificado

#### Scenario: Índice reproducible

- GIVEN un estado con insumos registrados
- WHEN se regenera el índice sin cambiar el estado
- THEN el contenido resultante es idéntico al anterior

### Requirement: Compatibilidad del contrato existente

La ingesta MUST apoyarse en `machine_process_input` sin alterar su firma ni su comportamiento
actual. Un insumo registrado por la ingesta MUST quedar en el estado con la misma forma que uno
registrado pasando los argumentos a mano.

#### Scenario: Estado indistinguible

- GIVEN un insumo registrado por la ingesta
- WHEN se compara su entrada en el estado con la de un insumo inyectado manualmente
- THEN ambas tienen la misma forma y los mismos campos
