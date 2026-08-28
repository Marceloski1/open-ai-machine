"""Genera packages/machine-core/templates/reference.docx.

Construye un archivo OOXML (.docx) minimo pero valido, pensado para usarse como
`pandoc --reference-doc`. No depende de Word, LibreOffice ni Pandoc: arma el
ZIP y los XML directamente con la biblioteca estandar (`zipfile`, `xml`).

Este script es la fuente de verdad del binario `reference.docx`. El binario
commiteado es unicamente su salida; para modificar el diseno, edita este
archivo y vuelve a ejecutarlo.

Uso:
    python tools/build-template/build-template.py
"""

from __future__ import annotations

import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = REPO_ROOT / "packages" / "machine-core" / "templates" / "reference.docx"

# Paleta neutra: grises y azul oscuro. Sin logos ni marca.
COLOR_INK = "1F2937"          # texto principal (gris muy oscuro)
COLOR_HEADING = "1E293B"      # encabezados (azul-gris oscuro)
COLOR_ACCENT = "1E3A5F"       # azul oscuro de acento (Title, enlaces, bordes)
COLOR_MUTED = "64748B"        # texto secundario (Subtitle, Author, Date, captions)
COLOR_RULE = "CBD5E1"         # lineas/bordes suaves
COLOR_CODE_BG = "F1F5F9"      # fondo de bloques de codigo
COLOR_CODE_TEXT = "334155"    # texto de codigo
COLOR_QUOTE_BAR = "94A3B8"    # barra lateral de citas

FONT_BODY = "Calibri"
FONT_HEADING = "Calibri"
FONT_MONO = "Consolas"

CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
  <Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

ROOT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

DOCUMENT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>
</Relationships>
"""

SETTINGS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="708"/>
  <w:compat/>
</w:settings>
"""

WEB_SETTINGS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:webSettings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:optimizeForBrowser/>
</w:webSettings>
"""

FONT_TABLE_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="{FONT_BODY}">
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="{FONT_MONO}">
    <w:family w:val="modern"/>
    <w:pitch w:val="fixed"/>
  </w:font>
</w:fonts>
"""

CORE_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                    xmlns:dc="http://purl.org/dc/elements/1.1/"
                    xmlns:dcterms="http://purl.org/dc/terms/"
                    xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Reference Template</dc:title>
  <dc:subject>Base neutral template for Pandoc DOCX rendering</dc:subject>
  <dc:creator>machine-core</dc:creator>
  <cp:keywords>pandoc reference-doc template</cp:keywords>
  <dc:description>Neutral base template generated by tools/build-template/build-template.py. Not a corporate brand.</dc:description>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>
"""

APP_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>machine-core build-template.py</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0000</AppVersion>
</Properties>
"""


def styles_xml() -> str:
    """Devuelve word/styles.xml con todos los w:styleId que Pandoc espera."""

    def rpr(*, font=FONT_BODY, size=22, color=COLOR_INK, bold=False, italic=False, caps=False):
        parts = [f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>']
        if bold:
            parts.append("<w:b/>")
        if italic:
            parts.append("<w:i/>")
        if caps:
            parts.append("<w:caps/>")
        parts.append(f'<w:color w:val="{color}"/>')
        parts.append(f'<w:sz w:val="{size}"/>')
        parts.append(f'<w:szCs w:val="{size}"/>')
        return "<w:rPr>" + "".join(parts) + "</w:rPr>"

    def ppr(*, before=0, after=160, line=276, keep_next=False, outline=None, extra=""):
        parts = [f'<w:spacing w:before="{before}" w:after="{after}" w:line="{line}" w:lineRule="auto"/>']
        if keep_next:
            parts.append("<w:keepNext/>")
        if outline is not None:
            parts.append(f'<w:outlineLvl w:val="{outline}"/>')
        parts.append(extra)
        return "<w:pPr>" + "".join(parts) + "</w:pPr>"

    heading_sizes = {1: 40, 2: 32, 3: 28, 4: 24, 5: 22, 6: 22}
    heading_spacing = {1: (360, 200), 2: (320, 160), 3: (280, 140), 4: (240, 120), 5: (220, 110), 6: (200, 100)}

    headings = []
    for level in range(1, 7):
        size = heading_sizes[level]
        before, after = heading_spacing[level]
        italic = level >= 5
        headings.append(f"""
  <w:style w:type="paragraph" w:styleId="Heading{level}">
    <w:name w:val="heading {level}"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="BodyText"/>
    <w:qFormat/>
    {ppr(before=before, after=after, line=264, keep_next=True, outline=level - 1)}
    {rpr(font=FONT_HEADING, size=size, color=COLOR_HEADING, bold=True)}
  </w:style>""")
    headings_xml = "".join(headings)

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      {rpr(size=22, color=COLOR_INK)}
    </w:rPrDefault>
    <w:pPrDefault>
      {ppr(before=0, after=160, line=276)}
    </w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=0, after=160, line=276)}
    {rpr(size=22, color=COLOR_INK)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Subtitle"/>
    <w:qFormat/>
    {ppr(before=0, after=80, line=300, keep_next=True, extra='<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="8" w:color="' + COLOR_RULE + '"/></w:pBdr>')}
    {rpr(font=FONT_HEADING, size=56, color=COLOR_ACCENT, bold=True)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="BodyText"/>
    <w:qFormat/>
    {ppr(before=0, after=240, line=276)}
    {rpr(font=FONT_HEADING, size=28, color=COLOR_MUTED, bold=False, italic=True)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="Author">
    <w:name w:val="Author"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=0, after=40, line=276)}
    {rpr(size=22, color=COLOR_MUTED, bold=True)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="Date">
    <w:name w:val="Date"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=0, after=240, line=276)}
    {rpr(size=20, color=COLOR_MUTED)}
  </w:style>

  {headings_xml}

  <w:style w:type="paragraph" w:styleId="BodyText">
    <w:name w:val="Body Text"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=0, after=160, line=288)}
    {rpr(size=22, color=COLOR_INK)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="FirstParagraph">
    <w:name w:val="First Paragraph"/>
    <w:basedOn w:val="BodyText"/>
    <w:qFormat/>
    {ppr(before=0, after=160, line=288)}
    {rpr(size=22, color=COLOR_INK)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="Compact">
    <w:name w:val="Compact"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=0, after=0, line=264)}
    {rpr(size=22, color=COLOR_INK)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="BlockText">
    <w:name w:val="Block Text"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=120, after=160, line=288, extra='<w:ind w:left="432" w:right="432"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="' + COLOR_QUOTE_BAR + '"/></w:pBdr>')}
    {rpr(size=22, color=COLOR_MUTED, italic=True)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="SourceCode">
    <w:name w:val="Source Code"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=120, after=160, line=240, extra='<w:ind w:left="144" w:right="144"/><w:shd w:val="clear" w:color="auto" w:fill="' + COLOR_CODE_BG + '"/>')}
    {rpr(font=FONT_MONO, size=20, color=COLOR_CODE_TEXT)}
  </w:style>

  <w:style w:type="character" w:styleId="VerbatimChar">
    <w:name w:val="Verbatim Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="{FONT_MONO}" w:hAnsi="{FONT_MONO}" w:cs="{FONT_MONO}"/>
      <w:color w:val="{COLOR_CODE_TEXT}"/>
      <w:shd w:val="clear" w:color="auto" w:fill="{COLOR_CODE_BG}"/>
    </w:rPr>
  </w:style>

  <w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">
    <w:name w:val="Default Paragraph Font"/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="TableCaption">
    <w:name w:val="Table Caption"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=80, after=200, line=240, extra='<w:jc w:val="center"/>')}
    {rpr(size=18, color=COLOR_MUTED, italic=True)}
  </w:style>

  <w:style w:type="paragraph" w:styleId="ImageCaption">
    <w:name w:val="Image Caption"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=80, after=200, line=240, extra='<w:jc w:val="center"/>')}
    {rpr(size=18, color=COLOR_MUTED, italic=True)}
  </w:style>

  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:rPr>
      <w:color w:val="{COLOR_ACCENT}"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    {ppr(before=0, after=80, line=276, extra='<w:ind w:left="432"/><w:contextualSpacing/>')}
    {rpr(size=22, color=COLOR_INK)}
  </w:style>
</w:styles>
"""


def _p(style: str | None, runs_xml: str) -> str:
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f"<w:p>{ppr}{runs_xml}</w:p>"


def _run(text: str, style: str | None = None) -> str:
    rpr = f'<w:rPr><w:rStyle w:val="{style}"/></w:rPr>' if style else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>'


def document_xml() -> str:
    """Cuerpo de ejemplo que ejercita cada estilo definido en styles.xml."""
    body_parts = [
        _p("Title", _run("Titulo del documento")),
        _p("Subtitle", _run("Subtitulo descriptivo del contenido")),
        _p("Author", _run("Nombre del autor o equipo")),
        _p("Date", _run("Fecha del documento")),
        _p("FirstParagraph", _run(
            "Este es el primer parrafo del cuerpo del documento. Usa el estilo "
            "FirstParagraph, pensado para el texto que abre una seccion sin "
            "sangria de continuacion."
        )),
        _p("Heading1", _run("Encabezado de nivel 1")),
        _p("BodyText", _run(
            "Texto de cuerpo estandar (BodyText), con interlineado comodo para "
            "lectura extensa en una propuesta de negocio."
        )),
        _p("Heading2", _run("Encabezado de nivel 2")),
        _p("BodyText", _run("Mas texto de cuerpo bajo un encabezado de segundo nivel.")),
        _p("Heading3", _run("Encabezado de nivel 3")),
        _p("Heading4", _run("Encabezado de nivel 4")),
        _p("Heading5", _run("Encabezado de nivel 5")),
        _p("Heading6", _run("Encabezado de nivel 6")),
        _p("Compact", _run("Linea compacta, sin espacio adicional entre parrafos.")),
        _p("Compact", _run("Segunda linea compacta, tipica de listas ajustadas.")),
        _p("ListParagraph", _run("Elemento de una lista con sangria estandar.")),
        _p("BlockText", _run(
            "Esta es una cita en bloque (BlockText): texto en cursiva, con "
            "barra lateral y sangria para diferenciarlo del cuerpo principal."
        )),
        _p("SourceCode", _run("def ejemplo():\n    return \"bloque de codigo monoespaciado\"")),
        _p("BodyText", (
            _run("Texto en linea con codigo ") + _run("inline_code()", "VerbatimChar")
            + _run(" y un ") + _run("enlace de ejemplo", "Hyperlink") + _run(".")
        )),
        _p("TableCaption", _run("Tabla 1. Titulo de ejemplo para una tabla.")),
        _p("ImageCaption", _run("Figura 1. Titulo de ejemplo para una imagen.")),
    ]

    section = """
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>"""

    body = "".join(body_parts) + section

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>{body}</w:body>
</w:document>
"""


def build(output_path: Path = OUTPUT_PATH) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    parts = {
        "[Content_Types].xml": CONTENT_TYPES_XML,
        "_rels/.rels": ROOT_RELS_XML,
        "word/document.xml": document_xml(),
        "word/styles.xml": styles_xml(),
        "word/settings.xml": SETTINGS_XML,
        "word/webSettings.xml": WEB_SETTINGS_XML,
        "word/fontTable.xml": FONT_TABLE_XML,
        "word/_rels/document.xml.rels": DOCUMENT_RELS_XML,
        "docProps/core.xml": CORE_XML,
        "docProps/app.xml": APP_XML,
    }

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as docx:
        for name, content in parts.items():
            docx.writestr(name, content.encode("utf-8"))

    return output_path


if __name__ == "__main__":
    path = build()
    print(f"reference.docx escrito en: {path}")
