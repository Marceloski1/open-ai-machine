# machine-discovery Specification

## Purpose

Segunda fase del pipeline: convierte los insumos clasificados como `route: discovery` y la propuesta de negocio aprobada en los artefactos de descubrimiento —requisitos, arquitectura de alto nivel, borradores de PRD, estimación, planificación y documento de proyecto—, cada uno protegido por sus puertas humanas.

> Origen: reescritura desde cero. No existe código original de referencia del plugin `machine-discovery` de Claude Code.

## Requirements

### Requirement: Estructura del proyecto de descubrimiento

`machine-discovery-init <proyecto>` MUST crear `docs/<proyecto>/discovery/` junto a la estructura que ya establece `machine-business-init`, y MUST ser idempotente: sobre un proyecto existente MUST NOT destruir contenido ya cargado.

#### Scenario: Proyecto que aún no tiene descubrimiento

- GIVEN un `<proyecto>` con `inputs/` y `.machine/state.json` existentes
- WHEN se ejecuta `machine-discovery-init`
- THEN se crea `discovery/` y el estado lo registra
- AND los insumos ya cargados se conservan intactos

#### Scenario: Reejecución sobre un descubrimiento existente

- GIVEN un `<proyecto>` con artefactos ya generados bajo `discovery/`
- WHEN se ejecuta `machine-discovery-init` de nuevo
- THEN la estructura se conserva y no se sobrescribe ningún artefacto

### Requirement: Trazabilidad de los artefactos

Todo comando de esta fase MUST derivar su contenido **únicamente** de los insumos registrados con `route: discovery` y de los artefactos aprobados aguas arriba. Todo dato sin respaldo MUST marcarse `NEEDS INPUT`, y MUST NOT inventarse contenido no derivable de esas fuentes.

#### Scenario: Dato sin respaldo en los insumos

- GIVEN insumos que no mencionan el volumen esperado de usuarios
- WHEN se genera un artefacto que requiere ese dato
- THEN la sección correspondiente queda marcada `NEEDS INPUT`
- AND MUST NOT completarse con una estimación inventada

#### Scenario: Insumo de otra ruta

- GIVEN un insumo registrado con `route: business`
- WHEN se genera un artefacto de descubrimiento
- THEN ese insumo MUST NOT usarse como fuente

### Requirement: Requisitos y Architecture Gate

`machine-requirements <proyecto>` MUST producir `docs/<proyecto>/discovery/requirements.md` a partir de los insumos de descubrimiento y de la propuesta de negocio aprobada. El artefacto MUST cerrar con el **Architecture Gate**, declarado en el estado como `approvals.requirements`.

#### Scenario: Propuesta de negocio sin aprobar

- GIVEN un `<proyecto>` cuyo `approvals.proposal` no está en `approved`
- WHEN se ejecuta `machine-requirements`
- THEN el comando MUST rechazar su ejecución
- AND MUST NOT escribir `requirements.md`

#### Scenario: Requisitos generados

- GIVEN una propuesta de negocio aprobada e insumos de descubrimiento procesados
- WHEN se ejecuta `machine-requirements`
- THEN se genera `requirements.md`
- AND el estado declara la puerta `approvals.requirements` pendiente

### Requirement: El Architecture Gate bloquea aguas abajo

`machine-hla` y todo comando que dependa de él —`machine-draft-prds`, `machine-time-estimation`, `machine-planning` y `machine-project-doc`— MUST rechazar su ejecución mientras `state.approvals.requirements` no esté en `approved`. La puerta MUST abrirse únicamente mediante `machine-approve`, que opera sobre cualquier puerta declarada.

#### Scenario: Puerta cerrada

- GIVEN un `<proyecto>` con `requirements.md` generado pero sin aprobar
- WHEN se ejecuta `machine-hla`
- THEN el comando MUST rechazar su ejecución indicando la puerta pendiente
- AND MUST NOT escribir ningún artefacto

#### Scenario: Puerta abierta por aprobación humana

- GIVEN un `<proyecto>` donde `machine-approve requirements` dejó la puerta en `approved`
- WHEN se ejecuta `machine-hla`
- THEN el comando procede

### Requirement: Arquitectura de alto nivel

`machine-hla <proyecto>` MUST producir `docs/<proyecto>/discovery/hla.md` derivado de los requisitos aprobados. Los diagramas MUST expresarse como bloques Mermaid en el Markdown, que es la fuente de verdad del diagrama.

#### Scenario: Arquitectura derivada de requisitos aprobados

- GIVEN un `<proyecto>` con el Architecture Gate en `approved`
- WHEN se ejecuta `machine-hla`
- THEN se genera `hla.md` con sus diagramas en bloques Mermaid

### Requirement: Pre-render de diagramas para el entregable

El renderizado a `.docx` MUST convertir cada bloque Mermaid a imagen antes de invocar Pandoc, porque Pandoc no interpreta Mermaid. El motor de pre-render MUST declararse como requisito externo del paquete, del mismo modo que `machine-core` declara `pandoc`.

#### Scenario: Motor de diagramas ausente

- GIVEN un entorno sin el motor de pre-render instalado
- WHEN se solicita el `.docx` de un artefacto con diagramas
- THEN el comando MUST fallar indicando el requisito externo faltante
- AND MUST NOT entregar un documento con el bloque Mermaid como texto crudo

### Requirement: Borradores de PRD

`machine-draft-prds <proyecto>` MUST producir un borrador de PRD por cada unidad funcional identificada en los requisitos aprobados, bajo `docs/<proyecto>/discovery/prds/`.

#### Scenario: Una unidad funcional por PRD

- GIVEN requisitos aprobados que identifican tres unidades funcionales
- WHEN se ejecuta `machine-draft-prds`
- THEN se genera un borrador por cada unidad

### Requirement: Estimación y planificación

`machine-time-estimation <proyecto>` MUST producir una estimación trazable a las unidades funcionales de los PRD, y `machine-planning <proyecto>` MUST producir el plan de trabajo derivado de esa estimación. Ninguno MUST estimar unidades que no aparezcan aguas arriba.

#### Scenario: Estimación sin PRD que la respalde

- GIVEN una unidad de trabajo que no corresponde a ningún PRD generado
- WHEN se ejecuta `machine-time-estimation`
- THEN esa unidad MUST NOT aparecer en la estimación

#### Scenario: Plan derivado de la estimación

- GIVEN una estimación generada
- WHEN se ejecuta `machine-planning`
- THEN el plan cubre exactamente las unidades estimadas

### Requirement: Documento de proyecto

`machine-project-doc <proyecto>` MUST consolidar los artefactos aprobados de la fase en `docs/<proyecto>/discovery/project.md`, y MUST NOT incluir artefactos cuya puerta siga pendiente.

#### Scenario: Consolidación con un artefacto pendiente

- GIVEN un `<proyecto>` donde la planificación aún no está aprobada
- WHEN se ejecuta `machine-project-doc`
- THEN el documento MUST NOT incorporar la planificación pendiente
- AND MUST señalar que falta esa aprobación

### Requirement: Reutilización de machine-core

El paquete MUST declarar `machine-core` como dependencia y consumir sus comandos compartidos —`machine-process-input`, `machine-approve` y `machine-render-docx`— sin redefinirlos. MUST NOT duplicar la lógica de estado, hash de insumos ni puertas de aprobación.

#### Scenario: Renderizado del entregable

- GIVEN un artefacto de descubrimiento con su puerta en `approved`
- WHEN se solicita el entregable `.docx`
- THEN se invoca `machine-render-docx` de `machine-core`
- AND MUST NOT existir una implementación propia del renderizado en este paquete
