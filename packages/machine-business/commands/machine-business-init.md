---
description: Inicializa la estructura estándar de un proyecto de negocio (<proyecto>).
agent: machine-business
---

Ejecuta el tool `machine_business_init` sobre el proyecto `$1`.

El tool es la única fuente de verdad: crea `docs/$1/inputs/`, `docs/$1/business/`,
`docs/$1/.machine/state.json` y el índice de archivos. Es idempotente — sobre un proyecto
existente no destruye contenido ya cargado. No repitas ni reimplementes esa lógica en el
prompt — invoca el tool y limítate a presentar lo que devuelve.

Al terminar:

1. Confirma la estructura creada o conservada para `$1`.
2. Sugiere el siguiente paso del pipeline: cargar insumos y ejecutar
   `/machine-process-input $1`.
