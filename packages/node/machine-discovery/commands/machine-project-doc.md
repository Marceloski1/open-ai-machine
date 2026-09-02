---
description: Consolida los artefactos aprobados de descubrimiento (discovery/project.md) del proyecto <proyecto>.
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_project_doc` sobre el proyecto `$1`.

El tool es la única fuente de verdad: exige que `approvals.requirements` esté en `approved` —el
**Architecture Gate**—, recorre los artefactos de la fase (requisitos, arquitectura, PRD,
estimación y plan), incorpora **solo** los que tengan su puerta en `approved`, escribe
`docs/$1/discovery/project.md` y fija `approvals.project` en `pending`.

Un artefacto cuya puerta siga pendiente **no** se incorpora: en su lugar el documento deja
constancia de qué aprobación falta. Uno que no se haya generado se señala como ausente. No
copies el contenido de un artefacto pendiente al documento por tu cuenta.

Al terminar:

1. Si el tool rechazó la operación porque el Architecture Gate no está aprobado, reporta el
   motivo exacto y sugiere `machine-approve $1 requirements`.
2. Indica qué artefactos se incorporaron, cuáles quedaron fuera por tener su puerta pendiente y
   cuáles no existen todavía, usando exactamente lo que devolvió el tool.
3. Para cada puerta pendiente, sugiere revisar su artefacto y ejecutar `machine-approve $1 <puerta>`,
   y recuerda que hay que volver a ejecutar este comando para que el documento la incluya.
4. Sugiere revisar `project.md` y ejecutar `machine-approve $1 project`.
