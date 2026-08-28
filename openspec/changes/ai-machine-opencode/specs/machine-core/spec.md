# machine-core Specification

## Purpose

Núcleo determinista: estado por proyecto, idempotencia por content-hash, puertas de aprobación y verificación de dependencias externas. Aloja los comandos compartidos entre fases.

## Requirements

### Requirement: Estado persistente por proyecto

El estado MUST vivir en `docs/<proyecto>/.machine/state.json` y contener `inputs[]` (con `path`, `sha256`, `processedAt`, `route`, `outputPath`), `approvals` y `phase`. El estado MUST ser la única fuente de verdad sobre qué se procesó y qué se aprobó.

#### Scenario: Inicialización del estado

- GIVEN un proyecto sin `.machine/state.json`
- WHEN se ejecuta cualquier comando de `machine-core`
- THEN se crea el archivo con `inputs` vacío y `approvals` vacío

#### Scenario: Estado corrupto

- GIVEN un `state.json` con JSON inválido
- WHEN un comando intenta leerlo
- THEN el comando falla con mensaje accionable
- AND MUST NOT sobrescribir el archivo

### Requirement: Idempotencia por content-hash

`machine-process-input` MUST calcular el SHA-256 del contenido de cada insumo y MUST NOT reprocesar un insumo cuyo hash ya figure en `inputs[]`. La comparación MUST ejecutarse en una herramienta determinista, MUST NOT delegarse al modelo.

#### Scenario: Insumo ya procesado

- GIVEN un insumo cuyo `sha256` ya está registrado
- WHEN se ejecuta `machine-process-input`
- THEN el insumo se omite
- AND su artefacto de salida permanece sin modificar

#### Scenario: Insumo modificado

- GIVEN un insumo ya registrado cuyo contenido cambió
- WHEN se ejecuta `machine-process-input`
- THEN el hash difiere y el insumo se reprocesa
- AND `sha256` y `processedAt` se actualizan

#### Scenario: Insumo de audio sin transcripción

- GIVEN un insumo de audio sin transcripción ni proveedor configurado
- WHEN se ejecuta `machine-process-input`
- THEN el registro se marca `NEEDS INPUT`
- AND MUST NOT generarse contenido inventado

### Requirement: Puertas humanas como estado verificable

Una puerta MUST representarse como `approvals.<gate>` con valor `pending`, `approved` o `rejected`. Toda operación protegida MUST rechazar su ejecución si la puerta requerida no está en `approved`. El rechazo MUST ocurrir aunque Opencode se ejecute con `--auto`.

#### Scenario: Operación protegida sin aprobación

- GIVEN `approvals.proposal` en `pending`
- WHEN se ejecuta `machine-render-docx` sobre el artefacto de propuesta
- THEN la operación se rechaza indicando la puerta pendiente
- AND MUST NOT generarse ningún `.docx`

#### Scenario: Ejecución no interactiva

- GIVEN una sesión iniciada con `opencode run --auto`
- WHEN se ejecuta una operación protegida sin aprobación
- THEN la operación se rechaza igualmente

### Requirement: Concesión explícita de aprobación

`machine-approve <proyecto> <gate>` MUST ser el único mecanismo que fije una puerta en `approved`. MUST rechazar puertas no declaradas y MUST registrar el instante de aprobación.

#### Scenario: Aprobación de puerta declarada

- GIVEN `approvals.requirements` en `pending`
- WHEN se ejecuta `machine-approve <proyecto> requirements`
- THEN el valor pasa a `approved` con marca temporal

#### Scenario: Puerta inexistente

- GIVEN una puerta no declarada por ningún paquete instalado
- WHEN se intenta aprobarla
- THEN el comando falla sin modificar el estado

### Requirement: Invalidación aguas abajo

Si un artefacto aprobado se regenera, las aprobaciones que dependen de él MUST volver a `pending`.

#### Scenario: Regeneración de un artefacto aprobado

- GIVEN `approvals.requirements` en `approved` y artefactos posteriores generados
- WHEN se regenera el artefacto de requirements
- THEN las aprobaciones aguas abajo vuelven a `pending`

### Requirement: Verificación de dependencias externas

Antes de ejecutar una operación que dependa de un binario externo, `machine-core` MUST verificar su presencia y MUST fallar con instrucción de instalación si falta. MUST NOT degradar el entregable silenciosamente.

#### Scenario: Pandoc ausente

- GIVEN un sistema sin Pandoc
- WHEN se ejecuta `machine-render-docx`
- THEN falla indicando cómo instalar Pandoc
- AND MUST NOT entregarse un Markdown renombrado como `.docx`

### Requirement: No recálculo aguas abajo

Un comando MUST consumir los valores ya aprobados aguas arriba y MUST NOT recalcularlos.

#### Scenario: Estimación ya aprobada

- GIVEN una estimación aprobada en el estado
- WHEN un comando posterior la necesita
- THEN la lee del estado sin recalcularla
