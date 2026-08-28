"""Verifica packages/node/machine-core/templates/reference.docx.

Comprueba unicamente lo que es verificable sin Pandoc instalado:

1. El archivo abre como ZIP valido (testzip() devuelve None).
2. Todas las partes XML parsean sin error.
3. Todos los w:styleId requeridos aparecen en word/styles.xml.
4. Cada entrada declarada en [Content_Types].xml existe en el ZIP, y viceversa
   (para las partes con Override; los Default por extension no se listan una
   a una).
5. word/_rels/document.xml.rels referencia styles.xml.
6. build() es reproducible: dos generaciones producen bytes identicos (sha256).

NO valida que Pandoc acepte o renderice correctamente la plantilla: eso
requiere Pandoc instalado y queda fuera del alcance de este script.

Uso:
    python tools/build-template/verify-template.py
"""

from __future__ import annotations

import hashlib
import importlib.util
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCX_PATH = REPO_ROOT / "packages" / "node" / "machine-core" / "templates" / "reference.docx"
BUILD_SCRIPT_PATH = Path(__file__).resolve().parent / "build-template.py"

REQUIRED_STYLE_IDS = [
    "Title",
    "Subtitle",
    "Author",
    "Date",
    "Heading1",
    "Heading2",
    "Heading3",
    "Heading4",
    "Heading5",
    "Heading6",
    "BodyText",
    "FirstParagraph",
    "Compact",
    "BlockText",
    "SourceCode",
    "VerbatimChar",
    "TableCaption",
    "ImageCaption",
    "Hyperlink",
    "ListParagraph",
]

CT_NS = "{http://schemas.openxmlformats.org/package/2006/content-types}"
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
RELS_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def fail(msg: str) -> None:
    print(f"FALLO: {msg}")
    sys.exit(1)


def main() -> None:
    ok = True

    if not DOCX_PATH.exists():
        fail(f"No existe el archivo: {DOCX_PATH}")

    print(f"Verificando: {DOCX_PATH}")

    # 1. ZIP valido
    with zipfile.ZipFile(DOCX_PATH) as zf:
        bad_file = zf.testzip()
        if bad_file is not None:
            ok = False
            print(f"  [1] ZIP invalido, entrada corrupta: {bad_file}")
        else:
            print("  [1] ZIP valido (testzip() == None). OK")

        names = set(zf.namelist())

        # 2. Todas las partes XML parsean sin error
        xml_parse_errors = []
        parsed_parts: dict[str, ET.Element] = {}
        for name in sorted(names):
            if name.endswith(".xml") or name.endswith(".rels"):
                try:
                    data = zf.read(name)
                    parsed_parts[name] = ET.fromstring(data)
                except ET.ParseError as exc:
                    xml_parse_errors.append((name, str(exc)))
        if xml_parse_errors:
            ok = False
            print("  [2] Partes XML con error de parseo:")
            for name, err in xml_parse_errors:
                print(f"        {name}: {err}")
        else:
            print(f"  [2] Todas las partes XML/rels parsean sin error ({len(parsed_parts)} partes). OK")

        # 3. Todos los w:styleId requeridos aparecen en word/styles.xml
        styles_root = parsed_parts.get("word/styles.xml")
        if styles_root is None:
            ok = False
            print("  [3] No se pudo leer/parsear word/styles.xml")
        else:
            found_ids = {
                el.get(f"{W_NS}styleId")
                for el in styles_root.findall(f"{W_NS}style")
                if el.get(f"{W_NS}styleId") is not None
            }
            missing = [sid for sid in REQUIRED_STYLE_IDS if sid not in found_ids]
            if missing:
                ok = False
                print(f"  [3] Faltan w:styleId requeridos: {missing}")
            else:
                print(f"  [3] Los {len(REQUIRED_STYLE_IDS)} w:styleId requeridos estan presentes. OK")

        # 4. Content types <-> ZIP coherentes
        ct_root = parsed_parts.get("[Content_Types].xml")
        if ct_root is None:
            ok = False
            print("  [4] No se pudo leer/parsear [Content_Types].xml")
        else:
            overrides = [
                el.get("PartName")
                for el in ct_root.findall(f"{CT_NS}Override")
            ]
            missing_in_zip = []
            for part_name in overrides:
                zip_entry = part_name.lstrip("/")
                if zip_entry not in names:
                    missing_in_zip.append(part_name)
            if missing_in_zip:
                ok = False
                print(f"  [4] Overrides declarados sin parte real en el ZIP: {missing_in_zip}")
            else:
                print(f"  [4] Las {len(overrides)} entradas Override de [Content_Types].xml existen en el ZIP. OK")

            declared_names = {p.lstrip("/") for p in overrides}
            xml_like_parts = {
                n for n in names
                if n.endswith(".xml") and not n.endswith(".rels") and n != "[Content_Types].xml"
            }
            undeclared = sorted(xml_like_parts - declared_names)
            if undeclared:
                ok = False
                print(f"  [4] Partes .xml en el ZIP sin Override en [Content_Types].xml: {undeclared}")
            else:
                print("  [4] Todas las partes .xml del ZIP (fuera de rels) tienen Override. OK")

        # 5. document.xml.rels referencia styles.xml
        doc_rels_root = parsed_parts.get("word/_rels/document.xml.rels")
        if doc_rels_root is None:
            ok = False
            print("  [5] No se pudo leer/parsear word/_rels/document.xml.rels")
        else:
            targets = [el.get("Target") for el in doc_rels_root.findall(f"{RELS_NS}Relationship")]
            if "styles.xml" in targets:
                print("  [5] word/_rels/document.xml.rels referencia styles.xml. OK")
            else:
                ok = False
                print(f"  [5] styles.xml NO esta referenciado en document.xml.rels (targets: {targets})")

    # 6. build() es reproducible: dos generaciones producen bytes identicos
    spec = importlib.util.spec_from_file_location("build_template", BUILD_SCRIPT_PATH)
    build_template = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(build_template)
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        out1 = build_template.build(tmp_path / "repro1.docx")
        out2 = build_template.build(tmp_path / "repro2.docx")
        hash1 = hashlib.sha256(out1.read_bytes()).hexdigest()
        hash2 = hashlib.sha256(out2.read_bytes()).hexdigest()
        if hash1 == hash2:
            print(f"  [6] build() es reproducible (sha256 {hash1}). OK")
        else:
            ok = False
            print(f"  [6] build() NO es reproducible: {hash1} != {hash2}")

    print()
    if ok:
        print("RESULTADO: todas las verificaciones pasaron.")
        print("NOTA: esto NO confirma que Pandoc acepte o renderice correctamente la plantilla;")
        print("Pandoc vive en el .venv del repositorio (uv sync); el render se valida aparte.")
        sys.exit(0)
    else:
        print("RESULTADO: una o mas verificaciones fallaron. Ver detalle arriba.")
        sys.exit(1)


if __name__ == "__main__":
    main()
