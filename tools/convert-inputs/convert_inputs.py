"""Convierte insumos de cualquier formato a Markdown con MarkItDown.

Es el complemento inverso de Pandoc en este repositorio: Pandoc renderiza los
artefactos Markdown aprobados a .docx, y esta herramienta hace el camino de
entrada, pasando los insumos crudos (PDF, Word, PowerPoint, Excel, HTML, CSV,
imagenes, audio, EPub) al Markdown que consume el pipeline.

MarkItDown vive en el .venv del repositorio (dependencia `markitdown[all]` en
pyproject.toml). NO debe instalarse en el sistema. Si falta: `uv sync`.

La conversion es idempotente: si el Markdown resultante coincide byte a byte
con el que ya existe en el destino, el archivo no se reescribe y el resultado
se reporta como `unchanged`.

Cuando un insumo no produce texto alguno se reporta como `empty` y NO se
escribe un .md vacio. El caso tipico son las imagenes: sin `llm_client` de por
medio, MarkItDown solo lee sus metadatos, asi que una foto sin EXIF no aporta
nada convertible y necesita OCR o un modelo de vision aparte.

Uso:
    uv run python tools/convert-inputs/convert_inputs.py docs/inputs
    uv run python tools/convert-inputs/convert_inputs.py acta.docx --out docs/inputs
    uv run python tools/convert-inputs/convert_inputs.py docs/inputs --dry-run
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

SUPPORTED_SUFFIXES = frozenset({
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".html",
    ".htm",
    ".csv",
    ".json",
    ".xml",
    ".zip",
    ".epub",
    ".msg",
    ".txt",
    ".rtf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".tiff",
    ".bmp",
    ".mp3",
    ".wav",
    ".m4a",
    ".flac",
    ".ogg",
})

IGNORED_DIRS = frozenset({".git", ".venv", "node_modules", "__pycache__", "dist", ".machine"})

Converter = Callable[[Path], str]


@dataclass(frozen=True)
class ConversionResult:
    source: Path
    dest: Path
    status: str


def is_supported(path: str | Path) -> bool:
    return Path(path).suffix.lower() in SUPPORTED_SUFFIXES


def _is_ignored(path: Path, root: Path) -> bool:
    return any(part in IGNORED_DIRS for part in path.relative_to(root).parts[:-1])


def discover(root: str | Path) -> list[Path]:
    """Devuelve los archivos convertibles bajo `root`, en orden estable."""
    root = Path(root)
    if not root.exists():
        raise FileNotFoundError(f"No existe el origen: {root}")
    if root.is_file():
        return [root] if is_supported(root) else []
    found = [
        path
        for path in root.rglob("*")
        if path.is_file() and is_supported(path) and not _is_ignored(path, root)
    ]
    return sorted(found, key=lambda path: path.relative_to(root).as_posix())


def target_path(source: str | Path, source_root: str | Path, out_dir: str | Path | None) -> Path:
    """Ruta .md destino, preservando la estructura relativa a `source_root`."""
    source = Path(source)
    if out_dir is None:
        return source.with_suffix(".md")
    relative = source.relative_to(source_root).with_suffix(".md")
    return Path(out_dir) / relative


def _markitdown_converter(source: Path) -> str:
    from markitdown import MarkItDown

    return MarkItDown(enable_plugins=False).convert(str(source)).text_content


def convert_tree(
    source: str | Path,
    out_dir: str | Path | None,
    converter: Converter | None = None,
    dry_run: bool = False,
) -> list[ConversionResult]:
    """Convierte a Markdown cada insumo bajo `source` y reporta que hizo."""
    source = Path(source)
    sources = discover(source)
    source_root = source.parent if source.is_file() else source
    convert = converter or _markitdown_converter

    results: list[ConversionResult] = []
    for path in sources:
        dest = target_path(path, source_root, out_dir)
        text = convert(path).strip()
        if not text:
            results.append(ConversionResult(path, dest, "empty"))
            continue
        markdown = f"{text}\n"
        if dest.exists() and dest.read_text(encoding="utf-8") == markdown:
            results.append(ConversionResult(path, dest, "unchanged"))
            continue
        if not dry_run:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(markdown, encoding="utf-8")
        results.append(ConversionResult(path, dest, "converted"))
    return results


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="convert-inputs",
        description="Convierte insumos a Markdown con MarkItDown.",
    )
    parser.add_argument("source", type=Path, help="Archivo o directorio de insumos a convertir.")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Directorio de salida. Por defecto escribe junto a cada original.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra que se convertiria sin escribir ningun archivo.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        results = convert_tree(args.source, args.out, dry_run=args.dry_run)
    except FileNotFoundError as error:
        print(f"FALLO: {error}")
        return 1

    if not results:
        print(f"No se encontraron insumos convertibles en: {args.source}")
        return 0

    for result in results:
        print(f"  [{result.status}] {result.source} -> {result.dest}")

    converted = sum(1 for result in results if result.status == "converted")
    unchanged = sum(1 for result in results if result.status == "unchanged")
    empty = sum(1 for result in results if result.status == "empty")
    prefix = "Simulacion: " if args.dry_run else ""
    print(f"{prefix}{converted} convertido(s), {unchanged} sin cambios, {empty} sin texto extraible.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
