---
description: Genera el plan de trabajo (discovery/planning.md) del proyecto <proyecto>.
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_planning` sobre el proyecto `$1`.

El tool es la única fuente de verdad: exige que `approvals.requirements` esté en `approved` —el
**Architecture Gate**—, lee las unidades ya estimadas en `docs/$1/discovery/estimation.md`,
escribe `docs/$1/discovery/planning.md` y fija `approvals.planning` en `pending`. El esfuerzo de
cada unidad lo arrastra el tool desde la estimación; no lo reescribas.

El plan cubre **exactamente** las unidades estimadas. No planifiques trabajo que no aparezca en
la estimación, ni una unidad cuyo esfuerzo haya quedado `NEEDS INPUT`: el tool rechaza la
operación completa en ambos casos.

Al terminar:

1. Si el tool rechazó la operación porque el Architecture Gate no está aprobado, reporta el
   motivo exacto y sugiere `machine-approve $1 requirements`.
2. Si la rechazó porque no hay estimación, reporta el motivo y sugiere `/machine-time-estimation $1`.
3. Si la rechazó por una unidad no estimada o sin esfuerzo, reporta el nombre exacto que
   devolvió. No la renombres para que encaje ni le inventes un esfuerzo.
4. Si se generó, indica qué unidades quedaron planificadas y cuáles siguen `NEEDS INPUT`. Una
   unidad estimada y sin hito **aparece en la tabla** marcada `NEEDS INPUT`, no se omite.
5. Sugiere revisar `planning.md` y ejecutar `machine-approve $1 planning`.
