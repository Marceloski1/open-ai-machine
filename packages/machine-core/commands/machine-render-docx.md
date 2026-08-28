---
description: Renderiza un artefacto Markdown aprobado a .docx vía Pandoc.
agent: machine
---

Ejecuta el tool `machine_render_docx` sobre el proyecto `$1` y el artefacto `$2`.

El tool decide si la operación procede: verifica que la puerta de aprobación correspondiente
esté en `approved`, comprueba que Pandoc esté disponible y aplica la plantilla corporativa vía
`--reference-doc` si existe. No repitas esa verificación en el prompt ni asumas que la puerta
está aprobada — el tool rechaza la operación aunque la sesión corra con `--auto`.

Al terminar:

1. Si el tool rechazó la operación por puerta pendiente, no aprobada o dependencia externa
   ausente (Pandoc, plantilla), reporta el motivo exacto que devolvió el tool y la acción que
   lo desbloquea (por ejemplo, `/machine-approve $1 <gate>`).
2. Si el `.docx` se generó, indica la ruta del archivo resultante.
3. Sugiere el siguiente paso del pipeline correspondiente a la fase del proyecto.
