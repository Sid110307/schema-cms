from schema_cms.core.js_exports import parse_exports, replace_export_value, _unquote_js_str, JSTemplate


def test_round_trip_string():
    src = 'export const x = "hello world";'
    exports, spans = parse_exports(src)

    assert exports["x"] == "hello world"
    out = replace_export_value(src, spans[0], "goodbye")
    assert 'export const x = "goodbye"' in out


def test_round_trip_template():
    src = "export const x = `line1\nline2`;"
    exports, spans = parse_exports(src)

    assert isinstance(exports["x"], JSTemplate)
    out = replace_export_value(src, spans[0], exports["x"])
    assert out == src


def test_escape_backslash_n():
    result = _unquote_js_str(r'"hello\\nworld"')
    assert result == "hello\\nworld"


def test_hex_number():
    src = "export const x = 0xFF;"
    exports, _ = parse_exports(src)
    assert exports["x"] == 255


def test_template_backtick_escaping():
    src = "export const x = `hello \\`world\\``;"
    exports, spans = parse_exports(src)

    assert "`" in exports["x"].text
    out = replace_export_value(src, spans[0], exports["x"])
    assert out == src
