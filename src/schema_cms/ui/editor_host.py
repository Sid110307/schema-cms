from PySide6.QtCore import Signal
from PySide6.QtWidgets import QFrame, QLabel, QVBoxLayout, QWidget

from .editors.graph_editor import GraphEditor
from .editors.markdown_editor import MarkdownEditor
from .editors.media_list_editor import MediaListEditor
from .editors.table_editor import TableEditor
from .. import ext
from ..core.js_exports import JSTemplate
from ..core.schema import schema_for


class EditorHost(QWidget):
    move_requested = Signal(object, object, int, str)

    def __init__(self):
        super().__init__()

        self.root_layout = QVBoxLayout(self)
        self.title = QLabel("Select an item to preview")
        self.root_layout.addWidget(self.title)

        div = QFrame()
        div.setFrameShape(QFrame.Shape.HLine)
        div.setFrameShadow(QFrame.Shadow.Sunken)
        self.root_layout.addWidget(div)

        self._editor = None
        self._current_ref = None
        self._store_set = None

    def set_store_setter(self, fn):
        self._store_set = fn

    def _clear_editor(self):
        if self._editor is None:
            return

        self.flush_pending()
        self.root_layout.removeWidget(self._editor)
        self._editor.deleteLater()
        self._editor = None

    def flush_pending(self):
        if self._editor is not None and hasattr(self._editor, "flush_pending"):
            self._editor.flush_pending()

    def _set_editor(self, ed):
        if hasattr(ed, "value_changed"):
            ed.value_changed.connect(self._commit)

        self._editor = ed
        self.root_layout.addWidget(self._editor, 1)

    def set_entry(self, ref, value, title=""):
        self._clear_editor()
        self._current_ref = ref
        s = schema_for(ref.export_name, value)

        kind = s.get("kind", "unknown")
        item_schema = s.get("item_schema")
        title_field = s.get("title_field", title)
        reverse = s.get("reverse", False)
        object_schemas = ext.get_object_schemas()
        self.title.setText(f"{ref.file_path.name}  →  {ref.export_name}")

        if factory := ext.get_editor(kind):
            context = {
                "schema":         s,
                "title_field":    title_field,
                "item_schema":    item_schema,
                "object_schemas": object_schemas,
            }
            custom = factory(ref, value, context)
            if custom is not None:
                self._set_editor(custom)
                return

        if kind == "document":
            if isinstance(value, JSTemplate):
                ed = MarkdownEditor(value.text)
                self._editor = ed
                self.root_layout.addWidget(ed, 1)
                ed.value_changed.connect(lambda t: self._commit(JSTemplate(t)))
                return
            else:
                ed = MarkdownEditor(value if isinstance(
                    value, str) else str(value))
        elif kind == "asset_collection":
            ed = MediaListEditor(value if isinstance(value, list) else [])
        elif kind == "collection":
            rows = value if isinstance(value, list) else []
            obj_schema = object_schemas.get(item_schema or "")
            ed = TableEditor(rows, object_schema = obj_schema, title_field = title_field,
                            reverse = reverse if isinstance(reverse, bool) else False,
                            move_enabled = bool(item_schema))
            ed.move_requested.connect(
                lambda row: self.move_requested.emit(ref, (), row, item_schema))
        elif kind == "graph":
            ed = GraphEditor(value if isinstance(value, (dict, list)) else {}, title_field,
                            object_schemas = object_schemas,
                            item_schema = s.get("item_schema"),
                            field_schemas = s.get("field_schemas"))
            ed.move_requested.connect(
                lambda path, row: self.move_requested.emit(
                    ref, path, row,
                    ((s.get("field_schemas") or {}).get(path[-1]) if path and isinstance(path[-1], str)
                     else None) or item_schema))
        elif isinstance(value, str):
            ed = MarkdownEditor(value)
        elif isinstance(value, (dict, list)):
            ed = GraphEditor(value, title_field)
        else:
            ed = MarkdownEditor(str(value))

        self._set_editor(ed)

    def _commit(self, new_value):
        if not self._store_set or not self._current_ref:
            return
        self._store_set(self._current_ref, new_value)
