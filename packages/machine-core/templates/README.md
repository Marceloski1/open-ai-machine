# Plantillas de `machine-core`

## Plantilla corporativa DOCX — `NEEDS INPUT`

Este directorio debe alojar la plantilla corporativa `.docx` que `machine_render_docx`
consume vía `pandoc --reference-doc=<plantilla>` para dar formato (estilos, encabezados,
márgenes, tipografía) a los `.docx` generados a partir de Markdown.

**Estado actual: la plantilla no está disponible.** Ningún archivo `.docx` corporativo fue
provisto como insumo del proyecto. Este README documenta el hueco; **no se crea ni se inventa**
un archivo `.docx` de relleno.

### Dónde debe colocarse

```
packages/machine-core/templates/reference.docx
```

El tool `machine_render_docx` (`packages/machine-core/src/index.ts`) debe resolver esta ruta
y pasarla a Pandoc como `--reference-doc`. Mientras el archivo no exista, el tool MUST fallar
de forma explícita indicando la ausencia — nunca degradar el entregable renombrando un
Markdown como `.docx`.

### Cómo se consume

```
pandoc <artefacto>.md --reference-doc=packages/machine-core/templates/reference.docx -o <artefacto>.docx
```

Pandoc toma los estilos definidos en el `.docx` de referencia (Word: "Estilos" del documento)
y los aplica al documento generado. La plantilla debe crearse en Word/LibreOffice a partir de
la identidad corporativa real, guardando los estilos con los nombres que Pandoc reconoce
(`Heading 1`, `Heading 2`, `Body Text`, etc.).

### Impacto del bloqueo

Mientras esta plantilla no se provea:

- `machine-render-docx` **no puede completarse end-to-end** para el escenario de exportación
  aprobada.
- Solo la ruta de rechazo (puerta pendiente, Pandoc ausente) es verificable hoy.
- Ningún comando ni tool debe sustituir esta ausencia por una plantilla genérica o inventada.

Quien provea la plantilla corporativa debe colocar el archivo en la ruta indicada arriba y
retirar esta advertencia de `NEEDS INPUT`.
