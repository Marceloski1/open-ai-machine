---
description: Genera los requisitos (discovery/requirements.md) del proyecto <proyecto> y abre el Architecture Gate.
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_requirements` sobre el proyecto `$1`.

El tool es la única fuente de verdad: exige que `approvals.proposal` esté en `approved`, deriva
alcance, requisitos funcionales, requisitos no funcionales y restricciones **únicamente** a partir
de los insumos con `route: discovery` ya registrados en `docs/$1/.machine/state.json`, escribe
`docs/$1/discovery/requirements.md` y fija `approvals.requirements` en `pending`. No repitas ni
reimplementes esa síntesis en el prompt — no completes con conocimiento general lo que el tool no
derivó de los insumos, y no uses insumos con `route: business` como fuente.

Al terminar:

1. Si el tool rechazó la operación porque la propuesta de negocio no está aprobada, reporta el
   motivo exacto que devolvió y sugiere `machine-approve $1 proposal`. No describas
   `requirements.md` como generado.
2. Si la rechazó por falta de insumos `route: discovery`, reporta el motivo exacto y sugiere
   cargar insumos y ejecutar `/machine-process-input $1`.
3. Si `requirements.md` se generó, indica su ruta y qué secciones quedaron marcadas
   `NEEDS INPUT` por falta de respaldo en los insumos, sin inventar contenido para completarlas.
4. Sugiere revisar `requirements.md` y ejecutar `machine-approve $1 requirements`: ese es el
   **Architecture Gate**, y hasta que esté en `approved` los comandos aguas abajo permanecen
   bloqueados.
