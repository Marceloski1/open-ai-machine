---
description: Prepara la estructura de la fase de descubrimiento de un proyecto (<proyecto>).
agent: machine-discovery
---

Ejecuta el tool `machine_discovery_init` sobre el proyecto `$1`.

El tool es la única fuente de verdad: crea `docs/$1/discovery/`, asegura `docs/$1/inputs/` y deja
listo `docs/$1/.machine/state.json`. Es idempotente — sobre un proyecto existente no destruye
insumos ni artefactos ya generados. No repitas ni reimplementes esa lógica en el prompt — invoca
el tool y limítate a presentar lo que devuelve.

Al terminar:

1. Confirma si `discovery/` se creó o ya existía, según lo que devuelva el tool.
2. Sugiere el siguiente paso del pipeline: cargar insumos de descubrimiento y ejecutar
   `/machine-process-input $1`, recordando que `machine-requirements` exige la propuesta de
   negocio aprobada.
