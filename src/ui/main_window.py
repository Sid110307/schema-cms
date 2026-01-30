import os

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QHBoxLayout, QMainWindow, QMessageBox, QPushButton, QSplitter, QVBoxLayout, QWidget

from .editor_host import EditorHost
from .pages_tree import PagesTree
from ..config import get_app_title

os.environ["QT_LOGGING_RULES"] = "qt.multimedia.*=false;qt.ffmpeg.*=false"


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

        self.tree = PagesTree(self.store)
        self.tree.export_selected.connect(self.on_export_selected)
        splitter.addWidget(self.tree)

        right = QWidget()
        right_layout = QVBoxLayout(right)
        splitter.addWidget(right)

        self.editor = EditorHost()
        self.editor.set_store_setter(self.store.set)
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

    def closeEvent(self, event):
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
            self.store.save_all()
            event.accept()

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

    def save_all(self):
        if saved := self.store.save_all():
            QMessageBox.information(
                self, "Saved", f"Saved {len(saved)} file(s).")
        else:
            QMessageBox.information(self, "Saved", "No changes to save.")
