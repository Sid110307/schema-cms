from PySide6.QtCore import Qt
from PySide6.QtWidgets import QHBoxLayout, QInputDialog, QMainWindow, QMessageBox, QPushButton, QSplitter, QVBoxLayout, QWidget

from .editor_host import EditorHost
from .editors.table_editor import pretty_label
from .pages_tree import PagesTree
from .. import ext
from ..config import get_app_title
from ..core.datastore import ExportRef
from ..core.schema import schema_for


class MainWindow(QMainWindow):
    def __init__(self, store, *, title: str | None = None):
        super().__init__()

        self.store = store
        self.setWindowTitle(title or get_app_title())

        self._current_ref = None
        self._build_ui()

    def _build_ui(self):
        root = QWidget()
        self.setCentralWidget(root)
        layout = QVBoxLayout(root)
        layout.setSpacing(10)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        layout.addWidget(splitter, 1)

        self.tree = self._create_pages_tree()
        self.tree.export_selected.connect(self.on_export_selected)
        splitter.addWidget(self.tree)

        right = QWidget()
        right_layout = QVBoxLayout(right)
        splitter.addWidget(right)

        self.editor = self._create_editor()
        self.editor.set_store_setter(self.store.set)
        self.editor.move_requested.connect(self.move_item)
        right_layout.addWidget(self.editor, 3)

        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 3)

        bar = QWidget()
        bar_lay = QHBoxLayout(bar)
        bar_lay.setContentsMargins(0, 8, 0, 0)
        bar_lay.setSpacing(10)

        self._build_footer(bar_lay)
        layout.addWidget(bar, 0)

    def _build_footer(self, bar_lay: QHBoxLayout):
        self.btn_save = QPushButton("Save")
        bar_lay.addStretch(1)
        bar_lay.addWidget(self.btn_save)
        self.btn_save.clicked.connect(self.save_all)

    def _create_pages_tree(self) -> PagesTree:
        return PagesTree(self.store)

    def _create_editor(self) -> EditorHost:
        return EditorHost()

    def closeEvent(self, event):
        self.editor.flush_pending()
        if not (hasattr(self.store, "has_unsaved") and self.store.has_unsaved()):
            event.accept()
            return

        res = QMessageBox.warning(
            self,
            "Unsaved changes",
            "You have unsaved changes.\n\nWhat would you like to do?",
            QMessageBox.StandardButton.Save |
            QMessageBox.StandardButton.Discard |
            QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Cancel,
        )

        if res == QMessageBox.StandardButton.Save:
            try:
                self.store.save_all()
                event.accept()
            except Exception as exc:
                QMessageBox.critical(self, "Save failed",
                                    f"Could not save changes:\n{exc}")
                event.ignore()
            return

        if res == QMessageBox.StandardButton.Discard:
            res2 = QMessageBox.question(
                self,
                "Confirm discard",
                "Are you sure you want to discard all unsaved changes?",
                QMessageBox.StandardButton.Yes |
                QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            if res2 == QMessageBox.StandardButton.Yes:
                event.accept()
            else:
                event.ignore()
            return

        event.ignore()

    def on_export_selected(self, ref):
        self._current_ref = ref
        value = self.store.get(ref)
        self.editor.set_entry(ref, value, ref.export_name)

    def _move_destinations(self, source_ref, source_path, item_schema):
        destinations = []
        for file_path in self.store.list_files():
            for export_name, value in self.store.load_file(file_path).items():
                ref = ExportRef(file_path, export_name)
                schema = schema_for(export_name, value)
                kind = schema.get("kind")
                label = ext.get_export_label(export_name)

                if kind == "collection" and schema.get("item_schema") == item_schema:
                    if isinstance(value, list) and all(isinstance(row, dict) for row in value):
                        destinations.append((f"{label} ({file_path.name})", ref, ()))

                if kind == "graph" and isinstance(value, (dict, list)):
                    field_schemas = schema.get("field_schemas") or {}

                    def visit(node, path):
                        if isinstance(node, list):
                            key = path[-1] if path else None
                            node_schema = field_schemas.get(key) or schema.get("item_schema")
                            if node_schema == item_schema and all(isinstance(row, dict) for row in node):
                                group = " → ".join(pretty_label(part) for part in path)
                                name = f"{label} → {group}" if group else label
                                destinations.append((f"{name} ({file_path.name})", ref, path))
                        elif isinstance(node, dict):
                            for key, child in node.items():
                                visit(child, path + (key,))

                    visit(value, ())

        return [(label, ref, path) for label, ref, path in destinations
                if ref != source_ref or path != tuple(source_path)]

    def move_item(self, source_ref, source_path, row, item_schema):
        self.editor.flush_pending()
        try:
            destinations = self._move_destinations(source_ref, source_path, item_schema)
        except Exception as exc:
            QMessageBox.critical(self, "Move failed", str(exc))
            return

        if not destinations:
            QMessageBox.information(self, "Move entry", "No compatible destination page or group is available.")
            return

        labels = [label for label, _, _ in destinations]
        label, ok = QInputDialog.getItem(self, "Move entry", "Destination:", labels, 0, False)
        if not ok:
            return

        destination_label, destination_ref, destination_path = destinations[labels.index(label)]
        try:
            self.store.move_item(source_ref, source_path, row, destination_ref, destination_path)
        except Exception as exc:
            QMessageBox.critical(self, "Move failed", str(exc))
            return

        self.editor.set_entry(source_ref, self.store.get(source_ref), source_ref.export_name)
        self.statusBar().showMessage(f"Moved entry to {destination_label}. Save to keep the change.", 8000)

    def save_all(self):
        self.editor.flush_pending()
        try:
            saved = self.store.save_all()
        except Exception as exc:
            QMessageBox.critical(self, "Save failed", f"Could not save changes:\n{exc}")
            return
        if saved:
            QMessageBox.information(
                self, "Saved", f"Saved {len(saved)} file(s).")
        else:
            QMessageBox.information(self, "Saved", "No changes to save.")
