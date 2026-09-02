---
description: Genera un borrador de PRD por unidad funcional (discovery/prds/) del proyecto <proyecto>.
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_draft_prds` sobre el proyecto `$1`.

El tool es la única fuente de verdad: exige que `approvals.requirements` esté en `approved` —el
**Architecture Gate**—, escribe un borrador por unidad funcional bajo `docs/$1/discovery/prds/`
y fija `approvals.prds` en `pending`. El nombre de cada archivo lo deriva el tool del título de
la unidad; no lo elijas tú.

Las unidades funcionales se identifican **únicamente** a partir de `requirements.md` aprobado.
No agregues unidades que no aparezcan ahí, aunque parezcan necesarias para completar el
producto.

Al terminar:

1. Si el tool rechazó la operación porque el Architecture Gate no está aprobado, reporta el
   motivo exacto y sugiere `machine-approve $1 requirements`. No describas los PRD como
   generados.
2. Si la rechazó porque no hay ninguna unidad funcional identificada, reporta el motivo y
   sugiere revisar `requirements.md`. No inventes unidades para poder continuar.
3. Si la rechazó por dos unidades que colisionan en el mismo archivo, reporta ambos títulos tal
   como los devolvió y pide que se distingan.
4. Si se generaron, lista los borradores creados y qué secciones quedaron `NEEDS INPUT` en cada
   uno. Recuerda que regenerar reemplaza los borradores de la corrida anterior.
5. Sugiere revisarlos y ejecutar `machine-approve $1 prds`.
