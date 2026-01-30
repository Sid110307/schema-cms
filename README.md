# schema-cms

An extensible CMS/editor for working with structured JS objects.

## Quick start

```bash
python -m schema_cms
```

## Configuration

### Environment variables

| Purpose                 | Description                                            | Variable                       | Default           |
|-------------------------|--------------------------------------------------------|--------------------------------|-------------------|
| Data entries directory  | The directory where data entry files are stored.       | `SCHEMA_CMS_DATA_ENTRIES_DIR`  | `.`               |
| Entry file glob         | The glob pattern to match data entry files.            | `SCHEMA_CMS_ENTRY_GLOB`        | `*.js`            |
| Public images directory | The directory where images are stored.                 | `SCHEMA_CMS_PUBLIC_IMAGES_DIR` | `./public/images` |
| Image path prefix in JS | The path prefix used in JS exports for mapping images. | `SCHEMA_CMS_JS_IMAGE_PREFIX`   | `/images/`        |
| App title               | The title of the application window.                   | `SCHEMA_CMS_APP_TITLE`         | `Schema CMS`      |

Example:

```bash
SCHEMA_CMS_DATA_ENTRIES_DIR=./data-entries
SCHEMA_CMS_ENTRY_GLOB=*.js
SCHEMA_CMS_PUBLIC_IMAGES_DIR=./public/images
SCHEMA_CMS_JS_IMAGE_PREFIX=/images/
SCHEMA_CMS_APP_TITLE="My CMS"
```

### Python configuration API

Takes priority over environment variables if both are set.

| Purpose                 | Function                  |
|-------------------------|---------------------------|
| Data entries directory  | `set_data_entries_dir()`  |
| Entry file glob         | `set_entry_glob()`        |
| Public images directory | `set_public_images_dir()` |
| Image path prefix in JS | `set_js_image_prefix()`   |
| App title               | `set_app_title()`         |

Example:

```python
from schema_cms.config import (
    set_data_entries_dir,
    set_entry_glob,
    set_public_images_dir,
    set_js_image_prefix,
    set_app_title,
)

set_data_entries_dir("./data-entries")
set_entry_glob("*.js")
set_public_images_dir("./public/images")
set_js_image_prefix("/images/")
set_app_title("My CMS")
```

## Customization

### Schemas

| Type            | Function                   | Example    |
|-----------------|----------------------------|------------|
| Document schema | `register_schema()`        | `"page"`   |
| Object schema   | `register_object_schema()` | `"person"` |

```python
from schema_cms import ext

ext.register_schema("page", {"kind": "document"})
ext.register_object_schema("person", {
    "name": "string",
    "img":  "image",
})
```

### Built-in editors

| Editor type     | Schema kind             | Description                                                                                                                                               |
|-----------------|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| MarkdownEditor  | `document`              | Editor for document or markdown fields.                                                                                                                   |
| MediaListEditor | `asset_collection`      | Editor for media lists (images/videos). Uses configured JS prefix and local public images dir for picking and previews.                                   |
| TableEditor     | `collection`            | Editor for list of dict collections. Uses `item_schema` to look up an object schema and renders rows in a table; supports add/edit/delete and reordering. |
| GraphEditor     | `graph`                 | Editor for nested dict/list structures with schema-aware behavior (`item_schema` for lists and `field_schemas` for dicts).                                |
| MarkdownEditor  | _(fallback: string)_    | If no schema kind matches and `value` is a `str`, edits it as markdown/text.                                                                              |
| GraphEditor     | _(fallback: dict/list)_ | If no schema kind matches and `value` is a `dict` or `list`, edits it as a generic nested structure.                                                      |
| MarkdownEditor  | _(fallback: other)_     | If no schema kind matches and `value` is of another type, converts it to string and edits as markdown/text.                                               |

### Custom editors

Custom editors can be registered for specific schema kinds. The editor factory function receives the `ref`, `value`, and
`context` parameters and should return a QWidget instance.

```python
from schema_cms import ext


def editor_factory(ref, value, context):
    return MyEditor(value, context)


ext.register_editor("document", editor_factory)
```

### Export labels

Customizes how export names are displayed in the pages tree.

```python
from schema_cms import ext

ext.set_export_label_resolver(
    lambda name: name.replace("_", " ").title()
)
```
