---
description: Aprueba una puerta declarada del pipeline (<proyecto> <gate>).
agent: build
---

Ejecuta el tool `machine_approve` con proyecto `$1` y puerta `$2`.

El tool es el único mecanismo que puede fijar una puerta en `approved`: valida que la puerta
esté declarada por algún paquete instalado, registra el instante de aprobación y rechaza sin
modificar el estado si la puerta no existe. No apruebes nada por tu cuenta ni describas la
puerta como aprobada si el tool no lo confirma.

Al terminar:

1. Confirma la puerta y el proyecto que quedaron en `approved`, con su marca temporal.
2. Si el tool rechazó la aprobación (puerta no declarada), reporta el motivo tal como lo
   devolvió el tool.
3. Sugiere el siguiente paso del pipeline que la puerta recién aprobada desbloquea (por
   ejemplo, `/machine-render-docx $1 <artefacto>`).
