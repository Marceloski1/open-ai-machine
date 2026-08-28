# machine-business Specification

## Purpose

Fase 0 del pipeline: convierte insumos de reunión en una propuesta de negocio aprobada y su entregable `proposal.docx`.

> Origen: reescritura desde cero sobre `docs/inputs/posted.md` (insumo privado, no versionado). No existe código original de referencia.

## Requirements

### Requirement: Estructura estándar de proyecto

`machine-business-init <proyecto>` MUST crear `docs/<proyecto>/` con `inputs/`, `business/` y `.machine/`, más un índice de archivos legible. MUST ser idempotente: sobre un proyecto existente MUST NOT destruir contenido.

#### Scenario: Proyecto nuevo

- GIVEN un `<proyecto>` inexistente
- WHEN se ejecuta `machine-business-init`
- THEN se crean `inputs/`, `business/`, `.machine/state.json` y el índice

#### Scenario: Proyecto existente

- GIVEN un `<proyecto>` con insumos ya cargados
- WHEN se ejecuta `machine-business-init` de nuevo
- THEN la estructura se conserva y no se pierde ningún archivo

### Requirement: Enrutado de insumos

`machine-process-input` MUST clasificar cada insumo y asignarle `route` con valor `business` o `discovery`, registrarlo en el estado y actualizar el índice. Un insumo no clasificable MUST marcarse `NEEDS INPUT`.

#### Scenario: Insumo de negocio

- GIVEN una nota de reunión con contenido de negocio
- WHEN se ejecuta `machine-process-input`
- THEN se genera su registro Markdown bajo `business/`
- AND el estado registra `route: business`

#### Scenario: Insumo ambiguo

- GIVEN un insumo cuyo contenido no permite clasificar
- WHEN se ejecuta `machine-process-input`
- THEN el registro se marca `NEEDS INPUT`
- AND MUST NOT asignarse una `route` arbitraria

### Requirement: Síntesis de la propuesta

`machine-business-proposal <proyecto>` MUST producir `docs/<proyecto>/business/proposal.md` sintetizando mercado, problema, solución y estimación **únicamente** a partir de los insumos con `route: business` registrados. Todo dato ausente MUST marcarse `NEEDS INPUT`. MUST NOT inventarse contenido no derivable de los insumos.

#### Scenario: Insumos suficientes

- GIVEN insumos de negocio procesados que cubren las cuatro secciones
- WHEN se ejecuta `machine-business-proposal`
- THEN se genera `proposal.md` con las cuatro secciones

#### Scenario: Sección sin respaldo

- GIVEN insumos que no mencionan el mercado
- WHEN se ejecuta `machine-business-proposal`
- THEN la sección de mercado queda marcada `NEEDS INPUT`

#### Scenario: Sin insumos procesados

- GIVEN un proyecto sin insumos con `route: business`
- WHEN se ejecuta `machine-business-proposal`
- THEN el comando falla indicando que faltan insumos
- AND MUST NOT generarse `proposal.md`

### Requirement: Puerta humana de la propuesta

Al generar `proposal.md`, el comando MUST fijar `approvals.proposal` en `pending`. Regenerar la propuesta MUST devolver la puerta a `pending`.

#### Scenario: Generación fija la puerta

- GIVEN un proyecto sin aprobaciones
- WHEN se genera `proposal.md`
- THEN `approvals.proposal` queda en `pending`

#### Scenario: Regeneración tras aprobar

- GIVEN `approvals.proposal` en `approved`
- WHEN se regenera `proposal.md`
- THEN `approvals.proposal` vuelve a `pending`

### Requirement: Exportación bloqueada por aprobación

`machine-render-docx` sobre `business/proposal.md` MUST rechazar su ejecución mientras `approvals.proposal` no esté en `approved`, y MUST verificar Pandoc y la plantilla corporativa antes de renderizar.

#### Scenario: Exportación aprobada

- GIVEN `approvals.proposal` en `approved`, Pandoc presente y plantilla disponible
- WHEN se ejecuta `machine-render-docx`
- THEN se genera `proposal.docx` con la plantilla corporativa

#### Scenario: Exportación sin aprobación

- GIVEN `approvals.proposal` en `pending`
- WHEN se ejecuta `machine-render-docx`
- THEN la operación se rechaza y no se crea ningún archivo

#### Scenario: Plantilla corporativa ausente

- GIVEN `approvals.proposal` en `approved` pero sin plantilla `.docx` disponible
- WHEN se ejecuta `machine-render-docx`
- THEN falla indicando que falta la plantilla
- AND MUST NOT entregarse un DOCX sin estilos corporativos

### Requirement: Encadenamiento sugerido

Al completar con éxito, cada comando SHOULD indicar el siguiente paso del pipeline.

#### Scenario: Fin de la síntesis

- GIVEN `proposal.md` recién generado
- WHEN el comando termina
- THEN sugiere revisar y ejecutar `machine-approve <proyecto> proposal`
