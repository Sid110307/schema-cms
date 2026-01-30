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
            available = {}

            for f in self.store.list_files():
                exports = self.store.load_file(f)
                for export_name in exports.keys():
                    if export_name not in available:
                        available[export_name] = f

            for export_name in sorted(available.keys()):
                f = available[export_name]
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
