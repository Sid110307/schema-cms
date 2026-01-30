from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QInputDialog, QLineEdit, QListWidget, QListWidgetItem, QMessageBox, \
    QVBoxLayout, QWidget

from .graph_editor import summarize
from ..icons import icon_button


class ListEditor(QWidget):
    value_changed = Signal(list)
    _ADD_CHOICES = ["Text", "Blank", "List", "Section (fields)"]

    def __init__(self, value):
        super().__init__()

        self.value = value
        self._updating = False

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(10)

        btns = QHBoxLayout()
        btns.setSpacing(6)

        self.btn_add = icon_button("add", tooltip = "Add an item")
        self.btn_del = icon_button("delete", tooltip = "Delete selected item")
        self.btn_up = icon_button("up", tooltip = "Move selected item up")
        self.btn_dn = icon_button("down", tooltip = "Move selected item down")

        btns.addWidget(self.btn_add)
        btns.addWidget(self.btn_del)
        btns.addStretch(1)
        btns.addWidget(self.btn_up)
        btns.addWidget(self.btn_dn)
        root.addLayout(btns)

        self.list = QListWidget()
        self.list.setFrameShape(QFrame.Shape.NoFrame)
        self.list.setSelectionMode(QListWidget.SelectionMode.SingleSelection)
        self.list.setAlternatingRowColors(True)
        root.addWidget(self.list, 1)

        self.inline = QLineEdit()
        self.inline.setPlaceholderText("Edit text...")
        self.inline.setVisible(False)
        root.addWidget(self.inline)

        self.btn_add.clicked.connect(self.add_item)
        self.btn_del.clicked.connect(self.delete_item)
        self.btn_up.clicked.connect(lambda: self.move(-1))
        self.btn_dn.clicked.connect(lambda: self.move(+1))

        self.list.currentRowChanged.connect(self._on_select)
        self.list.itemDoubleClicked.connect(self._begin_inline_edit)
        self.inline.textEdited.connect(self._inline_changed)

        self._populate()

    def _populate(self, keep_row=None):
        self._updating = True
        try:
            cur = self.list.currentRow() if keep_row is None else keep_row

            self.list.clear()
            for i, v in enumerate(self.value):
                label = f"Item {i + 1}"
                summary = summarize(v)
                it = QListWidgetItem(f"{label}: {summary}")
                it.setData(Qt.ItemDataRole.UserRole, i)

                if isinstance(v, str):
                    it.setFlags(
                        it.flags() | Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)
                else:
                    it.setFlags(
                        it.flags() | Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled)

                self.list.addItem(it)

            if self.list.count():
                cur = max(0, min(cur, self.list.count() - 1))
                self.list.setCurrentRow(cur)
            else:
                self.inline.setVisible(False)
                self.inline.setText("")
        finally:
            self._updating = False

        self._update_btn_states()

    def _update_btn_states(self):
        r = self.list.currentRow()
        has_sel = r >= 0

        self.btn_del.setEnabled(has_sel)
        self.btn_up.setEnabled(has_sel and r > 0)
        self.btn_dn.setEnabled(has_sel and 0 <= r < len(self.value) - 1)

    def _on_select(self, row):
        if self._updating:
            return
        self._update_btn_states()

        if 0 <= row < len(self.value) and isinstance(self.value[row], str):
            self.inline.setVisible(True)
            self.inline.setText(self.value[row])
        else:
            self.inline.setVisible(False)
            self.inline.setText("")

    def _begin_inline_edit(self, item):
        r = self.list.row(item)
        if 0 <= r < len(self.value) and isinstance(self.value[r], str):
            self.inline.setVisible(True)
            self.inline.setFocus()
            self.inline.selectAll()

    def _inline_changed(self, text):
        if self._updating:
            return
        r = self.list.currentRow()

        if 0 <= r < len(self.value) and isinstance(self.value[r], str):
            self.value[r] = text
            if it := self.list.item(r):
                it.setText(f"Item {r + 1}: {summarize(self.value[r])}")
            self.value_changed.emit(self.value)

    def _pick_new_value(self):
        kind, ok = QInputDialog.getItem(
            self, "Add item", "What would you like to add?", self._ADD_CHOICES, 0, False)
        if not ok:
            return None, False

        if kind == "Text":
            txt, ok = QInputDialog.getText(
                self, "Text", "Enter text:", QLineEdit.EchoMode.Normal, "")
            return (txt, True) if ok else (None, False)
        if kind == "Blank":
            return None, True
        if kind == "List":
            return [], True
        if kind == "Section (fields)":
            return {}, True
        return None, False

    def add_item(self):
        new_val, ok = self._pick_new_value()
        if not ok:
            return

        self.value.insert(0, new_val)
        self._populate(keep_row = 0)
        self.value_changed.emit(self.value)

    def delete_item(self):
        r = self.list.currentRow()
        if r < 0:
            return
        if QMessageBox.question(self, "Delete", "Delete this item?") != QMessageBox.StandardButton.Yes:
            return

        self.value.pop(r)
        new_row = min(r, len(self.value) - 1)
        self._populate(keep_row = max(new_row, 0))
        self.value_changed.emit(self.value)

    def move(self, direction: int):
        r = self.list.currentRow()
        if r < 0:
            return
        nr = r + direction
        if nr < 0 or nr >= len(self.value):
            return

        had_inline_focus = self.inline.isVisible() and self.inline.hasFocus()
        self.value[r], self.value[nr] = self.value[nr], self.value[r]

        item = self.list.takeItem(r)
        self.list.insertItem(nr, item)
        self.list.setCurrentRow(nr)

        for i in (r, nr):
            if 0 <= i < self.list.count():
                v = self.value[i]
                it = self.list.item(i)
                it.setData(Qt.ItemDataRole.UserRole, i)
                it.setText(f"Item {i + 1}: {summarize(v)}")

        self._update_btn_states()
        self.value_changed.emit(self.value)

        if 0 <= nr < len(self.value) and isinstance(self.value[nr], str):
            self.inline.setVisible(True)
            self.inline.setText(self.value[nr])
            if had_inline_focus:
                self.inline.setFocus(Qt.FocusReason.OtherFocusReason)
                self.inline.selectAll()
        else:
            self.inline.setVisible(False)
            self.inline.setText("")
