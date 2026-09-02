from __future__ import annotations

import pytest

from convert_inputs import (
    SUPPORTED_SUFFIXES,
    ConversionResult,
    convert_tree,
    discover,
    is_supported,
    parse_args,
    target_path,
)


def fake_converter(source):
    return f"convertido: {source.name}"


class TestIsSupported:
    def test_acepta_formatos_de_oficina(self):
        assert is_supported("informe.pdf")
        assert is_supported("acta.docx")
        assert is_supported("plan.pptx")
        assert is_supported("datos.xlsx")

    def test_ignora_mayusculas_en_la_extension(self):
        assert is_supported("INFORME.PDF")

    def test_rechaza_markdown_para_no_reconvertir_la_salida(self):
        assert not is_supported("propuesta.md")

    def test_rechaza_extensiones_desconocidas(self):
        assert not is_supported("binario.exe")
        assert not is_supported("sin-extension")


class TestDiscover:
    def test_encuentra_convertibles_recursivamente_y_ordenados(self, tmp_path):
        (tmp_path / "sub").mkdir()
        (tmp_path / "b.docx").write_text("b")
        (tmp_path / "a.pdf").write_text("a")
        (tmp_path / "sub" / "c.csv").write_text("c")

        encontrados = [p.relative_to(tmp_path).as_posix() for p in discover(tmp_path)]

        assert encontrados == ["a.pdf", "b.docx", "sub/c.csv"]

    def test_ignora_markdown_y_extensiones_no_soportadas(self, tmp_path):
        (tmp_path / "ya.md").write_text("ya")
        (tmp_path / "raro.exe").write_text("raro")
        (tmp_path / "bueno.csv").write_text("bueno")

        assert [p.name for p in discover(tmp_path)] == ["bueno.csv"]

    def test_ignora_directorios_de_dependencias_y_cache(self, tmp_path):
        for ruido in (".venv", "node_modules", "__pycache__", ".git", "dist"):
            (tmp_path / ruido).mkdir()
            (tmp_path / ruido / "x.csv").write_text("x")
        (tmp_path / "real.csv").write_text("real")

        assert [p.name for p in discover(tmp_path)] == ["real.csv"]

    def test_un_archivo_suelto_se_devuelve_a_si_mismo(self, tmp_path):
        archivo = tmp_path / "solo.docx"
        archivo.write_text("solo")

        assert discover(archivo) == [archivo]

    def test_un_archivo_suelto_no_soportado_no_devuelve_nada(self, tmp_path):
        archivo = tmp_path / "solo.exe"
        archivo.write_text("solo")

        assert discover(archivo) == []


class TestTargetPath:
    def test_preserva_la_estructura_relativa_bajo_out_dir(self, tmp_path):
        origen = tmp_path / "insumos" / "sub" / "acta.docx"
        destino = target_path(origen, tmp_path / "insumos", tmp_path / "salida")

        assert destino == tmp_path / "salida" / "sub" / "acta.md"

    def test_sin_out_dir_escribe_junto_al_original(self, tmp_path):
        origen = tmp_path / "acta.docx"

        assert target_path(origen, tmp_path, None) == tmp_path / "acta.md"


class TestConvertTree:
    def test_convierte_y_escribe_markdown(self, tmp_path):
        origen = tmp_path / "acta.docx"
        origen.write_text("binario")
        salida = tmp_path / "out"

        resultados = convert_tree(origen, salida, converter=fake_converter)

        destino = salida / "acta.md"
        assert resultados == [ConversionResult(origen, destino, "converted")]
        assert destino.read_text(encoding="utf-8") == "convertido: acta.docx\n"

    def test_es_idempotente_cuando_el_contenido_no_cambia(self, tmp_path):
        origen = tmp_path / "acta.docx"
        origen.write_text("binario")
        salida = tmp_path / "out"

        convert_tree(origen, salida, converter=fake_converter)
        segunda = convert_tree(origen, salida, converter=fake_converter)

        assert [r.status for r in segunda] == ["unchanged"]

    def test_reescribe_cuando_el_contenido_cambia(self, tmp_path):
        origen = tmp_path / "acta.docx"
        origen.write_text("binario")
        salida = tmp_path / "out"
        convert_tree(origen, salida, converter=fake_converter)

        resultados = convert_tree(origen, salida, converter=lambda p: "contenido nuevo")

        assert [r.status for r in resultados] == ["converted"]
        assert (salida / "acta.md").read_text(encoding="utf-8") == "contenido nuevo\n"

    def test_dry_run_no_escribe_nada(self, tmp_path):
        origen = tmp_path / "acta.docx"
        origen.write_text("binario")
        salida = tmp_path / "out"

        resultados = convert_tree(origen, salida, converter=fake_converter, dry_run=True)

        assert [r.status for r in resultados] == ["converted"]
        assert not salida.exists()

    def test_convierte_un_arbol_completo(self, tmp_path):
        insumos = tmp_path / "insumos"
        (insumos / "sub").mkdir(parents=True)
        (insumos / "a.pdf").write_text("a")
        (insumos / "sub" / "b.csv").write_text("b")
        salida = tmp_path / "out"

        resultados = convert_tree(insumos, salida, converter=fake_converter)

        assert len(resultados) == 2
        assert (salida / "a.md").exists()
        assert (salida / "sub" / "b.md").exists()

    def test_un_origen_inexistente_es_un_error(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            convert_tree(tmp_path / "no-existe", None, converter=fake_converter)


class TestParseArgs:
    def test_origen_es_obligatorio(self):
        with pytest.raises(SystemExit):
            parse_args([])

    def test_out_y_dry_run_son_opcionales(self):
        args = parse_args(["docs/inputs"])

        assert args.source.as_posix() == "docs/inputs"
        assert args.out is None
        assert args.dry_run is False

    def test_lee_out_y_dry_run(self):
        args = parse_args(["docs/inputs", "--out", "docs/md", "--dry-run"])

        assert args.out.as_posix() == "docs/md"
        assert args.dry_run is True


class TestConversionReal:
    def test_markitdown_convierte_un_csv_de_verdad(self, tmp_path):
        origen = tmp_path / "datos.csv"
        origen.write_text("nombre,rol\nAda,ingeniera\n", encoding="utf-8")
        salida = tmp_path / "out"

        resultados = convert_tree(origen, salida)

        assert [r.status for r in resultados] == ["converted"]
        markdown = (salida / "datos.md").read_text(encoding="utf-8")
        assert "Ada" in markdown
        assert "ingeniera" in markdown

    def test_markitdown_convierte_html_a_markdown(self, tmp_path):
        origen = tmp_path / "pagina.html"
        origen.write_text("<h1>Propuesta</h1><p>Cuerpo del texto.</p>", encoding="utf-8")
        salida = tmp_path / "out"

        convert_tree(origen, salida)

        markdown = (salida / "pagina.md").read_text(encoding="utf-8")
        assert "# Propuesta" in markdown
        assert "Cuerpo del texto." in markdown

    def test_los_formatos_declarados_incluyen_los_extras_instalados(self):
        for sufijo in (".pdf", ".docx", ".pptx", ".xlsx", ".html", ".csv", ".epub"):
            assert sufijo in SUPPORTED_SUFFIXES

    def test_convierte_un_pdf_real(self, pdf_file, tmp_path):
        convert_tree(pdf_file, tmp_path / "out")

        markdown = (tmp_path / "out" / "informe.md").read_text(encoding="utf-8")
        assert "Informe de descubrimiento" in markdown
        assert "Fase 0 del pipeline machine." in markdown

    def test_convierte_un_docx_real_mapeando_encabezados(self, docx_file, tmp_path):
        convert_tree(docx_file, tmp_path / "out")

        markdown = (tmp_path / "out" / "acta.md").read_text(encoding="utf-8")
        assert "# Encabezado de nivel 1" in markdown
        assert "## Encabezado de nivel 2" in markdown
        assert "Titulo del documento" in markdown

    def test_convierte_un_xlsx_real_a_tabla(self, xlsx_file, tmp_path):
        convert_tree(xlsx_file, tmp_path / "out")

        markdown = (tmp_path / "out" / "presupuesto.md").read_text(encoding="utf-8")
        assert "Fase0" in markdown
        assert "| concepto | monto |" in markdown
        assert "descubrimiento" in markdown

    def test_convierte_un_pptx_real_con_sus_diapositivas(self, pptx_file, tmp_path):
        convert_tree(pptx_file, tmp_path / "out")

        markdown = (tmp_path / "out" / "pitch.md").read_text(encoding="utf-8")
        assert "Propuesta de negocio" in markdown
        assert "Mercado, problema y solucion" in markdown


class TestSinContenidoExtraible:
    def test_una_imagen_sin_ocr_se_reporta_vacia_y_no_escribe_archivo(self, png_file, tmp_path):
        salida = tmp_path / "out"

        resultados = convert_tree(png_file, salida)

        assert [r.status for r in resultados] == ["empty"]
        assert not (salida / "pizarra.md").exists()

    def test_un_convertidor_que_no_extrae_nada_no_deja_markdown_vacio(self, tmp_path):
        origen = tmp_path / "acta.docx"
        origen.write_text("binario")
        salida = tmp_path / "out"

        vacio = "  " + chr(10) + chr(9)
        resultados = convert_tree(origen, salida, converter=lambda p: vacio)

        assert [r.status for r in resultados] == ["empty"]
        assert not (salida / "acta.md").exists()
