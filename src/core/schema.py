from .. import ext

SCHEMAS = {}
OBJECT_SCHEMAS = {}

ext._seed_defaults(SCHEMAS, OBJECT_SCHEMAS)


def schema_for(export_name, value):
    schema = ext.get_schemas().get(export_name)
    return dict(schema) if schema else {"kind": "unknown", "type": _infer_type(value)}


def _infer_type(value):
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    return "unknown"
