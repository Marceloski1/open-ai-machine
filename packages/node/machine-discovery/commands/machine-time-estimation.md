---
description: Estima el esfuerzo por unidad funcional (discovery/estimation.md) del proyecto <proyecto>.
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_time_estimation` sobre el proyecto `$1`.

El tool es la única fuente de verdad: exige que `approvals.requirements` esté en `approved` —el
**Architecture Gate**—, lee las unidades funcionales de los PRD ya generados en
`docs/$1/discovery/prds/`, escribe `docs/$1/discovery/estimation.md` y fija
`approvals.estimation` en `pending`.

Solo pueden estimarse unidades que tengan un PRD aguas arriba. Cada unidad se referencia por su
título o por el nombre de su archivo. **No estimes trabajo que no corresponda a ningún PRD**: el
tool rechaza la operación completa si aparece una unidad sin respaldo.

Al terminar:

1. Si el tool rechazó la operación porque el Architecture Gate no está aprobado, reporta el
   motivo exacto y sugiere `machine-approve $1 requirements`.
2. Si la rechazó porque no hay PRD generados, reporta el motivo y sugiere `/machine-draft-prds $1`.
3. Si la rechazó por una unidad sin PRD, reporta el nombre exacto que devolvió. No la renombres
   para que encaje ni inventes un PRD que la respalde.
4. Si se generó, indica qué unidades quedaron estimadas y cuáles siguen `NEEDS INPUT`. Una unidad
   con PRD y sin estimación **aparece en la tabla** marcada `NEEDS INPUT`, no se omite: señálala
   en vez de rellenarla con una cifra plausible.
5. Sugiere revisar `estimation.md` y ejecutar `machine-approve $1 estimation`.
