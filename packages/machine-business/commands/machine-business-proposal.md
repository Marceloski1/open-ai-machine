---
description: Sintetiza la propuesta de negocio (business/proposal.md) del proyecto <proyecto>.
agent: machine-business
---

Ejecuta el tool `machine_business_proposal` sobre el proyecto `$1`.

El tool es la única fuente de verdad: sintetiza mercado, problema, solución y estimación
**únicamente** a partir de los insumos con `route: business` ya registrados en
`docs/$1/.machine/state.json`, escribe `docs/$1/business/proposal.md` y fija
`approvals.proposal` en `pending`. No repitas ni reimplementes esa síntesis en el prompt — no
completes con conocimiento general lo que el tool no derivó de los insumos.

Al terminar:

1. Si el tool rechazó la operación por falta de insumos `route: business`, reporta el motivo
   exacto que devolvió y no describas `proposal.md` como generado.
2. Si `proposal.md` se generó, indica su ruta y qué secciones quedaron marcadas
   `NEEDS INPUT` por falta de respaldo en los insumos, sin inventar contenido para
   completarlas.
3. Sugiere revisar `proposal.md` y ejecutar `machine-approve $1 proposal` para desbloquear la
   exportación.
