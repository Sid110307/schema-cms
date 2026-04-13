from PySide6.QtCore import QSignalBlocker, QSize, Qt, Signal
from PySide6.QtWidgets import QTreeWidget, QTreeWidgetItem

from .. import ext
from ..core.datastore import ExportRef


class PagesTree(QTreeWidget):
    export_selected = Signal(object)

    def __init__(self, store):
        super().__init__()

        self.store = store
        self.setHeaderLabel("Data Entries")
        self.itemSelectionChanged.connect(self._on_select)

        self.setIndentation(8)
        self.refresh()

    def refresh(self):
        with QSignalBlocker(self):
            self.clear()

            for f in self.store.list_files():
                try:
                    exports = self.store.load_file(f)
                except Exception:
                    continue

                for export_name in exports.keys():
                    label = ext.get_export_label(export_name)
                    it = QTreeWidgetItem([label])
                    it.setSizeHint(0, QSize(0, 24))
                    it.setData(0, Qt.ItemDataRole.UserRole,
                            ExportRef(f, export_name))
                    self.addTopLevelItem(it)

    def _on_select(self):
        items = self.selectedItems()
        if not items:
            return

        ref = items[0].data(0, Qt.ItemDataRole.UserRole)
        if ref is not None:
            self.export_selected.emit(ref)
