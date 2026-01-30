import re
from dataclasses import dataclass

from PySide6.QtCore import QAbstractTableModel, QModelIndex, QSortFilterProxyModel, Qt, Signal
from PySide6.QtGui import QPainterPath, QRegion
from PySide6.QtWidgets import QDialog, QDialogButtonBox, QFormLayout, QHBoxLayout, QLineEdit, QMessageBox, \
    QPlainTextEdit, QTableView, QVBoxLayout, QWidget

from .media_list_editor import ImagePicker
from ..icons import icon_button
from ...core.js_exports import JSTemplate


@dataclass(frozen = True)
class FieldSpec:
    name: str
    kind: str = "string"
    multiline: bool = False


def _looks_multiline(key, value):
    if key.lower() in {"coursedescription", "description", "details", "content", "body", "notes"}:
        return True

    s = "" if value is None else str(value)
    return len(s) > 120 or "\n" in s


def pretty_label(k):
    if not isinstance(k, str):
        return str(k)

    s = k.strip()
    s = s.replace("_", " ")
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", s)
    s = re.sub(r"([A-Z])([A-Z][a-z])", r"\1 \2", s)
    s = re.sub(r"\s+", " ", s).strip()

    words = s.split(" ")
    out = []

    for w in words:
        if w.isupper():
            out.append(w)
        elif re.fullmatch(r"[A-Z]\.[A-Za-z]+", w) or "." in w:
            out.append(w)
        else:
            out.append(w.capitalize())
    return " ".join(out)


class RowFilterProxyModel(QSortFilterProxyModel):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._filter = ""

    def set_filter_text(self, text):
        self._filter = (text or "").strip().lower()
        self.invalidateFilter()

    def filterAcceptsRow(self, source_row, source_parent):
        if not self._filter:
            return True

        m = self.sourceModel()
        row = m.rows[source_row]  # type: ignore

        return self._filter in " ".join("" if v is None else str(v) for v in row.values()).lower()


class ListObjectTableModel(QAbstractTableModel):
    changed = Signal()

    def __init__(self, rows, columns, reverse=False):
        super().__init__()

        self.rows = rows
        self.columns = columns
        self.reverse = reverse

    def rowCount(self, _=QModelIndex()):
        return len(self.rows)

    def columnCount(self, _=QModelIndex()):
        return len(self.columns)

    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role != Qt.ItemDataRole.DisplayRole:
            return None

        if orientation == Qt.Orientation.Horizontal:
            if 0 <= section < len(self.columns):
                return pretty_label(self.columns[section])
            return ""
        return str(self.rowCount() - section) if self.reverse else str(section + 1)

    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid():
            return None

        r, c = index.row(), index.column()
        if not (0 <= r < len(self.rows) and 0 <= c < len(self.columns)):
            return None

        key = self.columns[c]
        val = self.rows[r].get(key, "")

        if isinstance(val, JSTemplate):
            val = val.text
        if role in (Qt.ItemDataRole.DisplayRole, Qt.ItemDataRole.EditRole):
            return "" if val is None else str(val)
        return None

    def flags(self, index):
        if not index.isValid():
            return Qt.ItemFlag.ItemIsEnabled
        return Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsEditable

    def setData(self, index, value, role=Qt.ItemDataRole.EditRole):
        if role != Qt.ItemDataRole.EditRole or not index.isValid():
            return False

        r, c = index.row(), index.column()
        if not (0 <= r < len(self.rows) and 0 <= c < len(self.columns)):
            return False

        key = self.columns[c]
        v = "" if value is None else str(value)

        old_val = self.rows[r].get(key, "")
        self.rows[r][key] = JSTemplate(
            v) if isinstance(old_val, JSTemplate) else v

        self.dataChanged.emit(
            index, index, [Qt.ItemDataRole.DisplayRole, Qt.ItemDataRole.EditRole])
        self.changed.emit()

        return True

    def set_rows(self, rows):
        self.beginResetModel()
        self.rows = rows
        self.endResetModel()
        self.changed.emit()

    def move_row(self, src_row, dst_row):
        if src_row == dst_row:
            return False
        if not (0 <= src_row < len(self.rows)):
            return False
        if not (0 <= dst_row < len(self.rows)):
            return False

        dest = dst_row if dst_row < src_row else dst_row + 1
        self.beginMoveRows(QModelIndex(), src_row,
                           src_row, QModelIndex(), dest)
        row = self.rows.pop(src_row)
        self.rows.insert(dst_row, row)
        self.endMoveRows()

        self.changed.emit()
        return True


class TableView(QTableView):
    def __init__(self, radius=12, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._radius = radius

    def showEvent(self, event):
        super().showEvent(event)
        self._update_mask()

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._update_mask()

    def _update_mask(self):
        vp = self.viewport()
        r = vp.rect()

        path = QPainterPath()
        path.addRoundedRect(r, self._radius, self._radius)

        vp.setMask(QRegion(path.toFillPolygon().toPolygon()))


class RecordDialog(QDialog):
    def __init__(self, title, fields, initial=None):
        super().__init__()

        self.setWindowTitle(title)
        self._fields = list(fields)
        self._widgets = {}
        self._spec_by_name = {f.name: f for f in self._fields}

        layout = QVBoxLayout(self)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight |
                               Qt.AlignmentFlag.AlignVCenter)
        layout.addLayout(form)
        initial = initial or {}

        for f in self._fields:
            v = initial.get(f.name, "")
            if isinstance(v, JSTemplate):
                v = v.text

            if f.kind == "image":
                w = ImagePicker(v)
            elif f.multiline or _looks_multiline(f.name, v):
                w = QPlainTextEdit()
                w.setPlainText("" if v is None else str(v))
            else:
                w = QLineEdit()
                w.setText("" if v is None else str(v))

            self._widgets[f.name] = w
            form.addRow(f.name, w)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def value(self):
        out = {}
        for name, w in self._widgets.items():
            if hasattr(w, "value"):
                v = w.value()
            elif isinstance(w, QPlainTextEdit):
                v = w.toPlainText().strip()
            else:
                v = w.text().strip()

            spec = self._spec_by_name.get(name)
            if spec and spec.kind == "template":
                out[name] = JSTemplate(v)
            else:
                out[name] = v

        return out


class TableEditor(QWidget):
    value_changed = Signal(list)

    def __init__(self, value, *, object_schema=None, title_field="title", default_columns=None, reverse=False):
        super().__init__()

        self.value = value
        self.object_schema = object_schema or {}
        self.title_field = title_field
        self.reverse = reverse

        cols = []
        seen = set()

        if self.object_schema:
            for k in self.object_schema.keys():
                if k not in seen:
                    cols.append(k)
                    seen.add(k)

        for row in (value or []):
            for k in row.keys():
                if k not in seen:
                    cols.append(k)
                    seen.add(k)
        if not cols:
            cols = (default_columns[:] if default_columns else [title_field])

        self.columns = cols
        self.model = ListObjectTableModel(
            self.value, self.columns, self.reverse)
        self.proxy = RowFilterProxyModel(self)
        self.proxy.setSourceModel(self.model)

        root = QVBoxLayout(self)
        top = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setPlaceholderText("Search...")
        self.search.textChanged.connect(
            lambda _: self.proxy.set_filter_text(self.search.text()))
        top.addWidget(self.search)

        self.btn_add = icon_button("add", tooltip = "Add an entry")
        self.btn_edit = icon_button("edit", tooltip = "Edit selected entry")
        self.btn_del = icon_button("delete", tooltip = "Delete selected entry")
        self.btn_up = icon_button("up", tooltip = "Move selected entry up")
        self.btn_dn = icon_button("down", tooltip = "Move selected entry down")

        top.addWidget(self.btn_add)
        top.addWidget(self.btn_edit)
        top.addWidget(self.btn_del)
        top.addStretch(1)
        top.addWidget(self.btn_up)
        top.addWidget(self.btn_dn)
        root.addLayout(top)

        self.table = TableView()
        self.table.setModel(self.proxy)
        self.table.setSelectionBehavior(
            QTableView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QTableView.SelectionMode.SingleSelection)
        self.table.setEditTriggers(
            QTableView.EditTrigger.DoubleClicked | QTableView.EditTrigger.EditKeyPressed |
            QTableView.EditTrigger.SelectedClicked
        )
        self.table.doubleClicked.connect(lambda _: self.edit_row())
        self.table.setHorizontalScrollMode(
            QTableView.ScrollMode.ScrollPerPixel)
        self.table.setVerticalScrollMode(QTableView.ScrollMode.ScrollPerPixel)
        self.table.verticalHeader().setDefaultSectionSize(36)
        self.table.horizontalHeader().setStretchLastSection(False)
        root.addWidget(self.table)

        self.btn_add.clicked.connect(self.add_row)
        self.btn_edit.clicked.connect(self.edit_row)
        self.btn_del.clicked.connect(self.delete_row)
        self.btn_up.clicked.connect(self.move_up)
        self.btn_dn.clicked.connect(self.move_down)

        self.table.selectionModel().selectionChanged.connect(
            lambda *_: self._update_action_states())
        self.model.changed.connect(self._update_action_states)
        self.model.dataChanged.connect(lambda *_: self._emit())

        self._update_action_states()

    def _field_specs(self):
        specs = []
        if self.object_schema:
            for k, v in self.object_schema.items():
                if isinstance(v, dict):
                    kind = v.get("type", "string")
                    multiline = v.get("multiline", False)
                    specs.append(
                        FieldSpec(name = k, kind = kind, multiline = multiline))
                else:
                    kind = v if isinstance(v, str) else "string"
                    specs.append(FieldSpec(name = k, kind = kind,
                                           multiline = _looks_multiline(k, None)))
        else:
            for k in self.columns:
                specs.append(FieldSpec(name = k, kind = "string",
                                       multiline = _looks_multiline(k, None)))

        return specs

    def _selected_row_index(self):
        sel = self.table.selectionModel().selectedRows()
        if not sel:
            return None

        proxy_index = sel[0]
        src_index = self.proxy.mapToSource(proxy_index)
        if not src_index.isValid():
            return None
        return src_index.row()

    def _emit(self):
        self.value_changed.emit(self.value)

    def _refresh_columns_from_row(self, row):
        changed = False
        for k in row.keys():
            if k not in self.columns:
                self.columns.append(k)
                changed = True

        if changed:
            self.model.beginResetModel()
            self.model.columns = self.columns
            self.model.endResetModel()
            self.proxy.set_filter_text(self.search.text())

    def _update_action_states(self):
        idx = self._selected_row_index()
        has_sel = idx is not None

        self.btn_edit.setEnabled(has_sel)
        self.btn_del.setEnabled(has_sel)

        if not has_sel:
            self.btn_up.setEnabled(False)
            self.btn_dn.setEnabled(False)

            return

        self.btn_up.setEnabled(idx > 0)
        self.btn_dn.setEnabled(idx < len(self.value) - 1)

    def add_row(self):
        dlg = RecordDialog("Add Entry", self._field_specs(), initial = {})
        if dlg.exec() != QDialog.DialogCode.Accepted:
            return

        row = dlg.value()
        self._refresh_columns_from_row(row)
        self.value.insert(0, row)
        self.proxy.set_filter_text(self.search.text())
        self._emit()

    def edit_row(self):
        idx = self._selected_row_index()
        if idx is None:
            return

        dlg = RecordDialog("Edit Entry", self._field_specs(),
                           initial = self.value[idx])
        if dlg.exec() != QDialog.DialogCode.Accepted:
            return

        row = dlg.value()
        self._refresh_columns_from_row(row)
        self.value[idx] = row
        self.proxy.set_filter_text(self.search.text())
        self._emit()

    def delete_row(self):
        idx = self._selected_row_index()
        if idx is None:
            return
        if QMessageBox.question(self, "Delete", "Delete selected entry?") != QMessageBox.StandardButton.Yes:
            return

        self.value.pop(idx)
        self.proxy.set_filter_text(self.search.text())
        self._emit()

    def _reselect(self, src_cur, src_prev):
        if self.model.move_row(src_cur, src_prev):
            new_proxy = self.proxy.mapFromSource(self.model.index(src_prev, 0))
            self.table.setCurrentIndex(new_proxy)
            self.table.selectionModel().select(new_proxy, self.table.selectionModel().SelectionFlag.ClearAndSelect |
                                               self.table.selectionModel().SelectionFlag.Rows)
            self.table.setFocus(Qt.FocusReason.OtherFocusReason)
            self._emit()

    def move_up(self):
        sel = self.table.selectionModel().selectedRows()
        if not sel:
            return

        p_row = sel[0].row()
        if p_row <= 0:
            return

        src_cur = self.proxy.mapToSource(self.proxy.index(p_row, 0)).row()
        src_prev = self.proxy.mapToSource(self.proxy.index(p_row - 1, 0)).row()
        self._reselect(src_cur, src_prev)

    def move_down(self):
        sel = self.table.selectionModel().selectedRows()
        if not sel:
            return

        p_row = sel[0].row()
        if p_row < 0 or p_row >= self.proxy.rowCount() - 1:
            return

        src_cur = self.proxy.mapToSource(self.proxy.index(p_row, 0)).row()
        src_next = self.proxy.mapToSource(self.proxy.index(p_row + 1, 0)).row()
        self._reselect(src_cur, src_next)
