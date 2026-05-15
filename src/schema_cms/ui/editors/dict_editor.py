from PySide6.QtCore import QTimer, Signal
from PySide6.QtWidgets import QFrame, QHBoxLayout, QInputDialog, QLabel, QLineEdit, QMessageBox, QScrollArea, \
    QVBoxLayout, QWidget

from ..icons import icon_button


class _FieldRow(QWidget):
    changed = Signal()
    delete_requested = Signal(str)

    def __init__(self, key, value):
        super().__init__()

        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(8)

        self._orig_key = key
        self.key_edit = QLineEdit(key)
        self.key_edit.setPlaceholderText("Field name")
        self.sep = QLabel(":")

        self.val_edit = QLineEdit("" if value is None else str(value))
        self.val_edit.setPlaceholderText("Value")
        self.btn_del = icon_button("delete", tooltip="Delete this field")

        lay.addWidget(self.key_edit, 2)
        lay.addWidget(self.sep)
        lay.addWidget(self.val_edit, 4)
        lay.addWidget(self.btn_del)

        self.key_edit.textEdited.connect(self.changed)
        self.val_edit.textEdited.connect(self.changed)
        self.btn_del.clicked.connect(
            lambda: self.delete_requested.emit(self._orig_key))

    def get_key(self):
        return self.key_edit.text().strip()

    def get_value(self):
        return self.val_edit.text()

    def set_orig_key(self, k):
        self._orig_key = k


class DictEditor(QWidget):
    value_changed = Signal(dict)

    def __init__(self, value):
        super().__init__()

        self.value = value
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(10)

        top = QHBoxLayout()
        top.setSpacing(6)

        self.btn_add = icon_button("add", tooltip="Add a new field")
        title = QLabel("Fields")

        top.addWidget(title)
        top.addStretch(1)
        top.addWidget(self.btn_add)
        root.addLayout(top)

        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setFrameShape(QFrame.Shape.NoFrame)

        self.host = QWidget()
        self.rows_layout = QVBoxLayout(self.host)
        self.rows_layout.setContentsMargins(0, 0, 0, 0)
        self.rows_layout.setSpacing(8)
        self.rows_layout.addStretch(1)

        self.scroll_area.setWidget(self.host)
        root.addWidget(self.scroll_area, 1)

        self._apply_timer = QTimer(self)
        self._apply_timer.setSingleShot(True)
        self._apply_timer.timeout.connect(self.apply)

        self.btn_add.clicked.connect(self.add_row)
        self._populate()

    def _clear_rows(self):
        while self.rows_layout.count() > 1:
            item = self.rows_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

    def _populate(self):
        self._clear_rows()
        for k, v in self.value.items():
            row = _FieldRow(str(k), "" if v is None else str(v))
            row.delete_requested.connect(self._delete_by_key)
            row.changed.connect(self._schedule_apply)
            self.rows_layout.insertWidget(self.rows_layout.count() - 1, row)

    def add_row(self):
        k, ok = QInputDialog.getText(
            self, "Add field", "Field name:", QLineEdit.EchoMode.Normal, "")
        if not ok or not k.strip():
            return

        k = k.strip()
        if k in self.value:
            QMessageBox.warning(self, "Already exists",
                                "Field already exists.")
            return

        self.value[k] = ""
        self._populate()
        self.value_changed.emit(self.value)

    def _delete_by_key(self, key):
        if key not in self.value:
            return
        if QMessageBox.question(self, "Delete", f"Delete \"{key}\"?") != QMessageBox.StandardButton.Yes:
            return

        self.value.pop(key, None)
        self._populate()
        self.value_changed.emit(self.value)

    def _schedule_apply(self):
        self._apply_timer.start(200)

    def apply(self):
        new = {}
        seen = set()

        for i in range(self.rows_layout.count() - 1):
            w = self.rows_layout.itemAt(i).widget()
            if not isinstance(w, _FieldRow):
                continue

            k = w.get_key()
            v = w.get_value()

            if not k:
                continue
            if k in seen:
                QMessageBox.warning(self, "Duplicate field",
                                    f"Field \"{k}\" is already set. Please use a different name.")
                return

            seen.add(k)
            new[k] = v

        self.value.clear()
        self.value.update(new)
        self.value_changed.emit(self.value)
