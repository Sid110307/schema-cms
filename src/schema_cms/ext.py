from __future__ import annotations

from typing import Any, Callable, Dict

SchemaDict = Dict[str, Any]
EditorFactory = Callable[[Any, Any, Dict[str, Any]], Any]
LabelResolver = Callable[[str], str]

_SCHEMAS: Dict[str, SchemaDict] = {}
_OBJECT_SCHEMAS: Dict[str, SchemaDict] = {}
_EDITORS: Dict[str, EditorFactory] = {}
_EXPORT_LABEL_RESOLVER: LabelResolver | None = None


def _seed_defaults(schemas: Dict[str, SchemaDict], object_schemas: Dict[str, SchemaDict]) -> None:
    if not _SCHEMAS:
        for name, schema in schemas.items():
            _SCHEMAS[name] = dict(schema) if isinstance(
                schema, dict) else schema
    if not _OBJECT_SCHEMAS:
        for name, schema in object_schemas.items():
            _OBJECT_SCHEMAS[name] = dict(
                schema) if isinstance(schema, dict) else schema


def register_schema(name: str, schema: SchemaDict) -> None:
    _SCHEMAS[name] = dict(schema)


def register_object_schema(name: str, schema: SchemaDict) -> None:
    _OBJECT_SCHEMAS[name] = dict(schema)


def register_editor(kind: str, factory: EditorFactory) -> None:
    _EDITORS[kind] = factory


def set_export_label_resolver(fn: LabelResolver) -> None:
    global _EXPORT_LABEL_RESOLVER
    _EXPORT_LABEL_RESOLVER = fn


def get_schemas() -> Dict[str, SchemaDict]:
    return dict(_SCHEMAS)


def get_object_schemas() -> Dict[str, SchemaDict]:
    return dict(_OBJECT_SCHEMAS)


def get_editors() -> Dict[str, EditorFactory]:
    return dict(_EDITORS)


def get_editor(kind: str) -> EditorFactory | None:
    return _EDITORS.get(kind)


def get_export_label(export_name: str) -> str:
    if _EXPORT_LABEL_RESOLVER is None:
        return export_name
    try:
        return str(_EXPORT_LABEL_RESOLVER(export_name))
    except Exception:
        return export_name
