---
description: Genera la arquitectura de alto nivel (discovery/hla.md) del proyecto <proyecto>.
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_hla` sobre el proyecto `$1`.

El tool es la única fuente de verdad: exige que `approvals.requirements` esté en `approved` —el
**Architecture Gate**—, deriva visión general, componentes, integraciones y decisiones técnicas
**únicamente** de los requisitos aprobados y de los insumos con `route: discovery`, escribe
`docs/$1/discovery/hla.md` y fija `approvals.hla` en `pending`. No repitas ni reimplementes esa
síntesis en el prompt.

Los diagramas se pasan al tool como bloques Mermaid: el Markdown es la fuente de verdad del
diagrama. No adjuntes imágenes ni describas un diagrama en prosa como sustituto.

Al terminar:

1. Si el tool rechazó la operación porque el Architecture Gate no está aprobado, reporta el
   motivo exacto que devolvió y sugiere revisar `requirements.md` y ejecutar
   `machine-approve $1 requirements`. No describas `hla.md` como generado.
2. Si `hla.md` se generó, indica su ruta y qué secciones quedaron marcadas `NEEDS INPUT`. Si no
   hubo ningún diagrama, la sección de diagramas queda `NEEDS INPUT`: señálalo, no lo rellenes.
3. Advierte que el entregable `.docx` todavía **no** puede renderizar estos diagramas: falta el
   pre-render de Mermaid a imagen, porque Pandoc no interpreta Mermaid.
4. Sugiere revisar `hla.md` y ejecutar `machine-approve $1 hla`.
