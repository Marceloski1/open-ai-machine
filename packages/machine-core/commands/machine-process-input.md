---
description: Procesa los insumos pendientes de un proyecto (hash, ruta y estado).
agent: build
---

Ejecuta el tool `machine_process_input` sobre el proyecto `$1`.

El tool es la única fuente de verdad: calcula el `sha256` de cada insumo, decide si ya fue
procesado, resuelve la ruta (`business` o `discovery`) y actualiza `docs/$1/.machine/state.json`.
No repitas ni reimplementes ese cálculo — invoca el tool y limítate a presentar lo que devuelve.

Al terminar:

1. Lista los insumos nuevos procesados y los omitidos por ya estar registrados (mismo `sha256`).
2. Si algún insumo quedó marcado `NEEDS INPUT` (p.ej. audio sin transcripción), señálalo explícitamente
   sin inventar contenido para completarlo.
3. Sugiere el siguiente paso del pipeline según la ruta detectada (por ejemplo,
   `/machine-business-proposal $1` si hay insumos con `route: business`).
