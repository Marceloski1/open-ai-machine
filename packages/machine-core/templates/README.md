# Plantillas de `machine-core`

## Cómo poner tu propia marca (sin tocar este paquete)

`machine_render_docx` no usa siempre `reference.docx`: resuelve la plantilla `.docx` en
**cascada**, quedándose con la primera que exista, en este orden de prioridad:

1. **`templatePath` explícito** — el argumento que ya recibe el tool, si se lo pasas.
2. **Plantilla del proyecto** — `docs/<proyecto>/.machine/template.docx`. Vive junto al resto
   del estado del proyecto (`state.json`), coherente con que el filesystem del proyecto es el
   estado. Úsala para dar marca a un proyecto puntual sin afectar a los demás.
3. **Plantilla del usuario** — `~/.config/opencode/templates/reference.docx`. Es la misma raíz
   donde vive la config global de Opencode (`~/.config/opencode/opencode.json`, ver
   `cli/src/paths.ts`), así que quien instala paquetes en modo `global` ya conoce esa carpeta.
   Coloca ahí tu `.docx` de marca una sola vez y se aplica a todos tus proyectos, sin repetir el
   archivo en cada uno.
4. **Plantilla base del paquete** — `packages/machine-core/templates/reference.docx`, la neutra
   descrita abajo. Es el último recurso: si no configuraste ninguna plantilla propia, tus
   documentos salen con este formato genérico.

**Ninguna sustitución de archivo dentro de `node_modules`/el paquete instalado es necesaria ni
recomendada** — eso se pierde en cada actualización. Coloca tu `.docx` en la ruta de proyecto o
de usuario de arriba y listo.

### Cómo saber qué plantilla se usó

`machine_render_docx` MUST informar qué plantilla aplicó: el resultado que devuelve incluye
`templatePath` (la ruta efectivamente usada) y `templateSource` (`"override" | "project" | "user"
| "package"`). Revisa ese campo antes de dar por hecho que un documento salió con tu marca — si
`templateSource` es `"package"`, salió con la plantilla neutra, no con la tuya.

## `reference.docx` — plantilla base neutra, NO identidad corporativa

`packages/machine-core/templates/reference.docx` existe en este repositorio y es usada por
`machine_render_docx` (`packages/machine-core/src/index.ts`, `defaultTemplatePath()` /
`defaultPandocRender()`) como `pandoc --reference-doc=<plantilla>` para dar formato a los
`.docx` generados a partir de Markdown, **únicamente cuando ninguna plantilla de proyecto ni de
usuario está presente** (ver cascada arriba).

**Este archivo es una plantilla base neutra generada por este repositorio.** Define una
jerarquia tipografica sobria (grises y azul oscuro), pensada para una propuesta de negocio
generica. **NO es, y no debe confundirse con, la identidad corporativa real de ningun cliente
ni de The AI Machine.** No contiene logos, nombres de empresa ni ninguna marca.

### Estado: sustitucion por la plantilla corporativa real — `NEEDS INPUT`

Sustituir `reference.docx` por la plantilla corporativa real (con la identidad de marca
verdadera) sigue pendiente como insumo externo. Mientras no se provea, `machine_render_docx`
producira documentos con el formato neutro descrito aqui, no con la marca del cliente. Quien
provea la plantilla corporativa real debe reemplazar este archivo y retirar esta advertencia.

### Pandoc: entorno gestionado por el repositorio, no un install de sistema

Pandoc **no se resuelve desde el PATH del sistema**. `machine_render_docx`
(`packages/machine-core/src/index.ts`, `resolveRepoPandocPath()` / `defaultPandocRender()`)
localiza el binario de Pandoc empaquetado por `pypandoc-binary` dentro del `.venv/` gestionado
por `uv` en la raiz del repositorio. Para tenerlo disponible:

```
uv sync
```

ejecutado desde la raiz del repositorio. Esto crea/actualiza `.venv/` e instala
`pypandoc-binary`, que trae un binario de Pandoc embebido (no requiere instalar Pandoc en el
sistema operativo). El entorno Python del repo (dependencias, `uv.lock`) vive en el
`pyproject.toml` de la raiz; `tools/build-template/` solo contiene los scripts que lo usan.

### Como se regenera

El `.docx` **no se edita a mano**: es la salida reproducible de un script. La fuente de verdad
es el script; el binario commiteado es su resultado.

```
uv run python tools/build-template/build-template.py
```

Esto reconstruye `packages/machine-core/templates/reference.docx` desde cero usando unicamente
la biblioteca estandar de Python (`zipfile`, `xml`) — sin Pandoc, sin Word, sin LibreOffice.
Para cambiar el diseno (colores, tipografia, espaciados), edita
`tools/build-template/build-template.py` y vuelve a ejecutar el comando.

### Como se verifica

```
uv run python tools/build-template/verify-template.py
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

### Validacion contra Pandoc real

Con el Pandoc empaquetado via `pypandoc-binary` (`uv sync`) se ejecuto
`pandoc <archivo>.md --reference-doc=reference.docx -o salida.docx` y se confirmo, inspeccionando
el `.docx` resultante como ZIP (`word/document.xml`, `word/styles.xml`), que Pandoc reconoce y
aplica los estilos de esta plantilla: los `w:pStyle` emitidos (`Heading1`–`Heading3`,
`FirstParagraph`, `Compact`, `SourceCode`, `BlockText`) corresponden a `w:styleId` reales
definidos en `styles.xml`, y los colores y tipografias de la plantilla (ver paleta arriba,
Calibri/Consolas) aparecen en el `.docx` de salida. No se abrio el resultado en Word ni
LibreOffice; la validacion visual manual en esas aplicaciones sigue pendiente.

### Como se consume

`pypandoc-binary` no expone `pandoc` como script del `.venv` (no funciona `uv run pandoc`); el
binario vive dentro de `site-packages` y se invoca por su ruta completa, tal como hace
`resolveRepoPandocPath()` en `packages/machine-core/src/index.ts`:

```
.venv/Lib/site-packages/pypandoc/files/pandoc.exe <artefacto>.md --reference-doc=packages/machine-core/templates/reference.docx -o <artefacto>.docx
```

(en POSIX, la ruta equivalente es `.venv/lib/python<version>/site-packages/pypandoc/files/pandoc`).

### Impacto mientras no se configure una plantilla propia (proyecto o usuario)

- `machine_render_docx` **funciona end-to-end**, pero si nadie coloca una plantilla de proyecto
  o de usuario (ver cascada arriba), produce documentos con el formato neutro de este
  repositorio, no con la identidad de marca de quien usa el marketplace.
- La validacion contra Pandoc real ya se realizo (ver seccion anterior); el contrato de fallo
  explicito ante plantilla ausente (`packages/machine-core/src/index.ts`) ya no aplica porque el
  archivo existe.
- Ningun tool debe presentar el resultado de este template neutro como si fuera la identidad
  corporativa real. El campo `templateSource` del resultado de `machine_render_docx` es la forma
  programatica de distinguirlo.
