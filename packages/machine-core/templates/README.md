# Plantillas de `machine-core`

## `reference.docx` — plantilla base neutra, NO identidad corporativa

`packages/machine-core/templates/reference.docx` existe en este repositorio y es usada por
`machine_render_docx` (`packages/machine-core/src/index.ts`, `defaultTemplatePath()` /
`defaultPandocRender()`) como `pandoc --reference-doc=<plantilla>` para dar formato a los
`.docx` generados a partir de Markdown.

**Este archivo es una plantilla base neutra generada por este repositorio.** Define una
jerarquia tipografica sobria (grises y azul oscuro), pensada para una propuesta de negocio
generica. **NO es, y no debe confundirse con, la identidad corporativa real de ningun cliente
ni de The AI Machine.** No contiene logos, nombres de empresa ni ninguna marca.

### Estado: sustitucion por la plantilla corporativa real — `NEEDS INPUT`

Sustituir `reference.docx` por la plantilla corporativa real (con la identidad de marca
verdadera) sigue pendiente como insumo externo. Mientras no se provea, `machine_render_docx`
producira documentos con el formato neutro descrito aqui, no con la marca del cliente. Quien
provea la plantilla corporativa real debe reemplazar este archivo y retirar esta advertencia.

### Como se regenera

El `.docx` **no se edita a mano**: es la salida reproducible de un script. La fuente de verdad
es el script; el binario commiteado es su resultado.

```
python tools/build-template/build-template.py
```

Esto reconstruye `packages/machine-core/templates/reference.docx` desde cero usando unicamente
la biblioteca estandar de Python (`zipfile`, `xml`) — sin Pandoc, sin Word, sin LibreOffice.
Para cambiar el diseno (colores, tipografia, espaciados), edita
`tools/build-template/build-template.py` y vuelve a ejecutar el comando.

### Como se verifica

```
python tools/build-template/verify-template.py
```

El verificador comprueba automaticamente:

1. El archivo abre como ZIP valido.
2. Todas las partes XML (`word/document.xml`, `word/styles.xml`, etc.) parsean sin error.
3. Los `w:styleId` que Pandoc busca al copiar formato de una reference doc estan presentes en
   `word/styles.xml`: `Title`, `Subtitle`, `Author`, `Date`, `Heading1`–`Heading6`, `BodyText`,
   `FirstParagraph`, `Compact`, `BlockText`, `SourceCode`, `VerbatimChar`, `TableCaption`,
   `ImageCaption`, `Hyperlink`, `ListParagraph`.
4. Cada parte declarada en `[Content_Types].xml` existe en el ZIP, y viceversa.
5. `word/_rels/document.xml.rels` referencia `styles.xml`.

Esto **no** confirma que Pandoc acepte o renderice correctamente la plantilla.

### Que NO esta validado

**Pandoc no esta instalado en este entorno de desarrollo.** No fue posible:

- Generar la plantilla con `pandoc --print-default-data-file reference.docx` como punto de
  partida (por eso se construye el OOXML directamente).
- Ejecutar `pandoc <archivo>.md --reference-doc=reference.docx -o salida.docx` y confirmar que
  Pandoc reconoce y aplica los estilos.
- Abrir el `.docx` resultante en Word o LibreOffice y confirmar visualmente el render.

Esta validacion contra Pandoc real queda **pendiente**. Lo que este README certifica es
unicamente lo verificable sin Pandoc: estructura ZIP/XML valida y presencia de los `w:styleId`
requeridos (ver seccion anterior).

### Como se consume

```
pandoc <artefacto>.md --reference-doc=packages/machine-core/templates/reference.docx -o <artefacto>.docx
```

### Impacto mientras la plantilla corporativa real no se provea

- `machine_render_docx` **funciona end-to-end**, pero produce documentos con el formato neutro
  de este repositorio, no con la identidad de marca del cliente.
- La validacion contra Pandoc real sigue pendiente (ver arriba); el contrato de fallo explicito
  ante plantilla ausente (`packages/machine-core/src/index.ts`) ya no aplica porque el archivo
  existe.
- Ningun tool debe presentar el resultado de este template neutro como si fuera la identidad
  corporativa real.
