import json
import re
from dataclasses import dataclass
from pathlib import Path

from tree_sitter import Language, Parser
from tree_sitter_javascript import language

from ..config import get_js_image_prefix, get_public_images_dir

_parser = Parser(Language(language()))
_JS_IDENT = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")


def _normalized_prefix():
    prefix = get_js_image_prefix() or ""
    if prefix and not prefix.endswith("/"):
        prefix = prefix + "/"
    return prefix


def js_to_local_path(js_path):
    prefix = _normalized_prefix()
    if not prefix or not isinstance(js_path, str) or not js_path.startswith(prefix):
        return None

    rel = js_path[len(prefix):]
    return (get_public_images_dir() / rel).resolve()


def local_to_js_path(local_path):
    public_dir = get_public_images_dir().resolve()
    p = Path(local_path).resolve()
    try:
        rel = p.relative_to(public_dir)
    except ValueError:
        return None

    prefix = _normalized_prefix()
    if not prefix:
        return None
    return prefix + rel.as_posix()


@dataclass(frozen = True)
class ExportSpan:
    name: str
    init_start: int
    init_end: int


@dataclass(frozen = True)
class JSTemplate:
    text: str


def _node_text(src, n):
    return src[n.start_byte:n.end_byte].decode("utf-8")


def find_export_nodes(js_text):
    src = js_text.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    out = []
    stack = [root]

    while stack:
        n = stack.pop()
        for ch in reversed(n.named_children):
            stack.append(ch)

        if n.type != "export_statement":
            continue

        for c in n.named_children:
            if c.type != "lexical_declaration":
                continue
            for d in c.named_children:
                if d.type != "variable_declarator":
                    continue

                name_node = None
                value_node = None
                for ch in d.named_children:
                    if ch.type == "identifier" and name_node is None:
                        name_node = ch
                    elif value_node is None:
                        value_node = ch

                if name_node is not None and value_node is not None:
                    out.append((_node_text(src, name_node), value_node))

    return out


def _unquote_js_str(s):
    s = s.strip()
    if len(s) < 2:
        return s

    q = s[0]
    if q not in ("'", '"') or s[-1] != q:
        return s

    body = s[1:-1]
    body = body.replace("\\\\", "\\")
    if q == "'":
        body = body.replace("\\'", "'")
    else:
        body = body.replace('\\"', '"')

    body = body.replace("\\n", "\n").replace("\\t", "\t").replace("\\r", "\r")
    body = re.sub(r"\\u\{([0-9a-fA-F]+)}",
                  lambda m: chr(int(m.group(1), 16)), body)
    body = re.sub(r"\\u([0-9a-fA-F]{4})",
                  lambda m: chr(int(m.group(1), 16)), body)

    return body


def _node_to_py(src, n):
    t = n.type
    s = _node_text(src, n).strip()

    if t in ("template_string", "template_literal"):
        return JSTemplate(
            s[1:-1].replace("\\`", "`") if s.startswith("`") and s.endswith("`") else s.replace("\\`", "`"))
    if t == "string":
        return _unquote_js_str(s)
    if t == "number":
        try:
            return float(s) if any(c in s for c in ".eE") else int(s, 10)
        except Exception:
            return s
    if t == "true":
        return True
    if t == "false":
        return False
    if t == "null":
        return None
    if t == "unary_expression":
        op = None
        arg = None

        for ch in n.children:
            if not ch.is_named and op is None:
                op = _node_text(src, ch).strip()
            elif ch.is_named and arg is None:
                arg = ch

        v = _node_to_py(src, arg) if arg else s
        return -v if op == "-" and isinstance(v, (int, float)) else s
    if t in ("array", "array_expression"):
        return [_node_to_py(src, ch) for ch in n.named_children]
    if t in ("object", "object_expression"):
        out = {}
        for ch in n.named_children:
            if ch.type != "pair":
                continue
            named = ch.named_children
            if len(named) < 2:
                continue

            k_node, v_node = named[0], named[1]
            kt = _node_text(src, k_node).strip()

            if k_node.type in ("property_identifier", "identifier"):
                key = kt
            elif k_node.type == "string":
                key = _unquote_js_str(kt)
            else:
                key = kt

            out[key] = _node_to_py(src, v_node)
        return out
    return s


def find_export_spans(js_text):
    src = js_text.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    spans = []
    stack = [root]

    while stack:
        n = stack.pop()
        for ch in reversed(n.named_children):
            stack.append(ch)
        if n.type != "export_statement":
            continue

        for c in n.named_children:
            if c.type != "lexical_declaration":
                continue
            for d in c.named_children:
                if d.type != "variable_declarator":
                    continue

                name_node = None
                value_node = None
                for ch in d.named_children:
                    if ch.type == "identifier" and name_node is None:
                        name_node = ch
                    elif value_node is None:
                        value_node = ch

                if name_node and value_node:
                    spans.append(ExportSpan(name = _node_text(src, name_node), init_start = value_node.start_byte,
                                            init_end = value_node.end_byte))

    return spans


def parse_exports(js_text):
    src = js_text.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    exports = {}
    spans = []
    stack = [root]

    while stack:
        n = stack.pop()
        for ch in reversed(n.named_children):
            stack.append(ch)
        if n.type != "export_statement":
            continue

        for c in n.named_children:
            if c.type != "lexical_declaration":
                continue
            for d in c.named_children:
                if d.type != "variable_declarator":
                    continue

                name_node = None
                value_node = None
                for ch in d.named_children:
                    if ch.type == "identifier" and name_node is None:
                        name_node = ch
                    elif value_node is None:
                        value_node = ch

                if name_node and value_node:
                    name = _node_text(src, name_node)
                    exports[name] = _node_to_py(src, value_node)
                    spans.append(
                        ExportSpan(name = name, init_start = value_node.start_byte, init_end = value_node.end_byte))

    return exports, spans


def _js_str(s):
    return json.dumps(s, ensure_ascii = False)


def _to_js(v, indent=0):
    pad = "\t" * indent

    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, JSTemplate):
        body = v.text.replace("\\", "\\\\").replace("`", "\\`")
        return f"`{body}`"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return _js_str(v)

    if isinstance(v, list):
        if not v:
            return "[]"

        items = [("\t" * (indent + 1)) + _to_js(x, indent + 1) for x in v]
        return "[\n" + ",\n".join(items) + "\n" + pad + "]"
    if isinstance(v, dict):
        if not v:
            return "{}"
        rows = []

        for k, val in v.items():
            ks = str(k)
            kk = ks if _JS_IDENT.match(ks) else _js_str(ks)
            rows.append(("\t" * (indent + 1)) +
                        f"{kk}: {_to_js(val, indent + 1)}")
        return "{\n" + ",\n".join(rows) + "\n" + pad + "}"

    return _js_str(str(v))


def serialize_value(value):
    return _to_js(value, 0)


def replace_export_value(js_text, span, new_value):
    b = js_text.encode("utf-8")
    new_raw = serialize_value(new_value).encode("utf-8")
    out = b[:span.init_start] + new_raw + b[span.init_end:]

    return out.decode("utf-8")
