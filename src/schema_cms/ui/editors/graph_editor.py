import re
from pathlib import Path
from dataclasses import dataclass
from typing import Tuple, Union

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QHBoxLayout, QInputDialog, QLabel, QLineEdit, QMessageBox, QTreeWidget, QTreeWidgetItem, \
    QVBoxLayout, QWidget

from .dict_editor import DictEditor
from .list_editor import ListEditor
from .markdown_editor import MarkdownEditor
from .media_list_editor import IMAGE_EXTS, ImagePicker, VIDEO_EXTS
from .table_editor import TableEditor, pretty_label
from ..icons import icon_button
from ...core.js_exports import JSTemplate, _normalized_prefix, summarize

Key = Union[str, int]


@dataclass(frozen = True)
class NodeRef:
    path: Tuple[Key, ...]


def _is_media_path(s):
    if not isinstance(s, str):
        return False
    prefix = _normalized_prefix()

    if prefix and s.startswith(prefix):
        return Path(s.split("?")[0]).suffix.lower() in (IMAGE_EXTS | VIDEO_EXTS)
    if s.lower().startswith(("http://", "https://")):
        base = s.split("?", 1)[0].split("#", 1)[0]
        return any(base.lower().endswith(ext) for ext in (IMAGE_EXTS | VIDEO_EXTS))

    return False


def _get_at(root, path):
    cur = root
    for p in path:
        try:
            cur = cur[p]
        except (KeyError, IndexError, TypeError):
            raise LookupError(f"Path {'/'.join(str(x) for x in path)} not found") from None
    return cur


def _set_at(root, path, value):
    if not path:
        raise ValueError("Cannot set the top-level value directly")

    parent = _get_at(root, path[:-1])
    parent[path[-1]] = value


def _del_at(root, path):
    parent = _get_at(root, path[:-1])
    last = path[-1]

    if isinstance(parent, list) and isinstance(last, int):
        parent.pop(last)
    elif isinstance(parent, dict) and isinstance(last, str):
        parent.pop(last)


class GraphEditor(QWidget):
    value_changed = Signal(object)
    _ADD_CHOICES = [
        "Text",
        "Number",
        "List",
        "Section (fields)",
    ]

    def __init__(self, value, title="", *, object_schemas=None, item_schema=None, field_schemas=None):
        super().__init__()

        self.value = value
        self._current_path = tuple()
        self._sub = None
        self._title = title
        self._seen = set()

        self._object_schemas = object_schemas or {}
        self._item_schema = item_schema
        self._field_schemas = field_schemas or {}

        root = QHBoxLayout(self)
        root.setContentsMargins(10, 10, 10, 10)
        root.setSpacing(12)

        left = QVBoxLayout()
        left.setSpacing(8)
        root.addLayout(left, 2)

        hdr = QLabel("Outline")
        left.addWidget(hdr)

        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Item", "Summary"])
        self.tree.setColumnWidth(0, 260)
        self.tree.setUniformRowHeights(True)
        left.addWidget(self.tree, 1)

        btns = QHBoxLayout()
        btns.setSpacing(6)

        self.btn_add = icon_button("add", tooltip = "Add something here")
        self.btn_del = icon_button("delete", tooltip = "Delete selected item")
        self.btn_up = icon_button("up", tooltip = "Move selected item up")
        self.btn_dn = icon_button("down", tooltip = "Move selected item down")

        btns.addWidget(self.btn_add)
        btns.addWidget(self.btn_del)
        btns.addStretch(1)
        btns.addWidget(self.btn_up)
        btns.addWidget(self.btn_dn)
        left.addLayout(btns)

        self.btn_add.clicked.connect(self._add_child)
        self.btn_del.clicked.connect(self._delete_node)
        self.btn_up.clicked.connect(lambda: self._move(-1))
        self.btn_dn.clicked.connect(lambda: self._move(+1))

        right = QVBoxLayout()
        right.setSpacing(6)
        root.addLayout(right, 4)

        self.node_title = QLabel("Details")
        right.addWidget(self.node_title)
        self.node_meta = QLabel("")
        right.addWidget(self.node_meta)

        self.sub_host = QWidget()
        self.sub_layout = QVBoxLayout(self.sub_host)
        self.sub_layout.setContentsMargins(0, 0, 0, 0)
        right.addWidget(self.sub_host, 1)

        self.tree.itemSelectionChanged.connect(self._on_select)
        self._rebuild_tree()

    def _rebuild_tree(self):
        self.tree.clear()
        self._seen = set()
        self._add_tree_nodes(None, self.value, tuple())
        self.tree.expandToDepth(0)

        if self._current_path:
            if it := self._find_item_by_path(self._current_path):
                self.tree.setCurrentItem(it)
                return

        if self.tree.topLevelItemCount():
            if first_item := self.tree.topLevelItem(0):
                self.tree.setCurrentItem(first_item)

    def _add_tree_nodes(self, parent_item, v, path):
        if isinstance(v, (dict, list)):
            vid = id(v)
            if vid in self._seen:
                label = self._title or "Document" if not path else (
                    f"Item {path[-1] + 1}" if isinstance(path[-1], int) else pretty_label(path[-1]))
                it = QTreeWidgetItem([label, "↩︎ (cycle)"])
                it.setData(0, Qt.ItemDataRole.UserRole, NodeRef(path))

                if parent_item is None:
                    self.tree.addTopLevelItem(it)
                else:
                    parent_item.addChild(it)

                return
            self._seen.add(vid)

        if not path:
            label = self._title or "Document"
        else:
            last = path[-1]
            label = f"Item {last + 1}" if isinstance(
                last, int) else pretty_label(last)

        it = QTreeWidgetItem([label, summarize(v)])
        it.setData(0, Qt.ItemDataRole.UserRole, NodeRef(path))

        if parent_item is None:
            self.tree.addTopLevelItem(it)
        else:
            parent_item.addChild(it)

        if isinstance(v, dict):
            for k in v.keys():
                self._add_tree_nodes(it, v[k], path + (k,))
        elif isinstance(v, list):
            for i in range(len(v)):
                self._add_tree_nodes(it, v[i], path + (i,))

    def _find_item_by_path(self, path):
        def walk(item):
            ref = item.data(0, Qt.ItemDataRole.UserRole)
            if ref and isinstance(ref, NodeRef) and ref.path == path:
                return item

            for i in range(item.childCount()):
                if found := walk(item.child(i)):
                    return found
            return None

        for i in range(self.tree.topLevelItemCount()):
            found = walk(self.tree.topLevelItem(i))
            if found:
                return found
        return None

    def _clear_sub(self):
        if self._sub is not None:
            self.sub_layout.removeWidget(self._sub)
            self._sub.deleteLater()
            self._sub = None

    def _on_select(self):
        items = self.tree.selectedItems()
        if not items:
            return

        ref = items[0].data(0, Qt.ItemDataRole.UserRole)
        if not ref:
            return

        path = ref.path
        self._current_path = path
        val = self.value if not path else _get_at(self.value, path)

        if not path:
            self.node_title.setText(self._title or "Document")
        else:
            self.node_title.setText(
                f"{self._title + ' → ' if self._title else ''}{'Item ' + str(path[-1] + 1) if isinstance(path[-1], int) else pretty_label(path[-1])}")

        if _is_media_path(val):
            self.node_meta.setText("Media")
        elif isinstance(val, dict):
            self.node_meta.setText(
                f"{len(val)} field{'' if len(val) == 1 else 's'}")
        elif isinstance(val, list):
            self.node_meta.setText(
                f"{len(val)} item{'' if len(val) == 1 else 's'}")
        elif isinstance(val, str | JSTemplate):
            self.node_meta.setText("Text")
        elif isinstance(val, (int, float)):
            self.node_meta.setText("Number")
        else:
            self.node_meta.setText("Value")

        self._clear_sub()
        self._sub = self._make_editor_for(val, path)
        self.sub_layout.addWidget(self._sub, 1)
        self._update_action_states()

    def _update_action_states(self):
        self.btn_del.setEnabled(bool(self._current_path))

        enable_move = False
        can_up = False
        can_dn = False

        if self._current_path:
            parent_path = self._current_path[:-1]
            last = self._current_path[-1]
            if isinstance(last, int):
                parent = _get_at(
                    self.value, parent_path) if parent_path else self.value
                if isinstance(parent, list):
                    enable_move = True
                    can_up = last > 0
                    can_dn = last < (len(parent) - 1)

        self.btn_up.setEnabled(enable_move and can_up)
        self.btn_dn.setEnabled(enable_move and can_dn)

    def _make_editor_for(self, val, path):
        if _is_media_path(val):
            ed = ImagePicker(val)
            ed.value_changed.connect(lambda t: self._set_leaf(path, t))
            return ed

        if isinstance(val, list):
            if val and all(isinstance(x, dict) for x in val):
                schema_name = self._field_schemas.get(path[-1]) if path and isinstance(path[-1], str) else None
                schema_name = schema_name or self._item_schema
                obj_schema = self._object_schemas.get(schema_name or "") if schema_name else None
                ed = TableEditor(val, object_schema=obj_schema, title_field="title")
                ed.value_changed.connect(lambda _v: self._commit())
                return ed

            ed = ListEditor(val)
            ed.value_changed.connect(lambda _v: self._commit())
            return ed

        if isinstance(val, dict):
            if all(isinstance(vv, (str, JSTemplate, int, float, bool)) or vv is None for vv in val.values()):
                ed = DictEditor(val)
                ed.value_changed.connect(lambda _v: self._commit())
                return ed

            ed = QLabel("Select an item to preview")
            ed.setObjectName("accent")
            ed.setAlignment(Qt.AlignmentFlag.AlignCenter)
            ed.setMinimumHeight(200)

            return ed

        if isinstance(val, JSTemplate):
            ed = MarkdownEditor(val.text)
            ed.value_changed.connect(
                lambda t: self._set_leaf(path, JSTemplate(t)))

            return ed

        if isinstance(val, str):
            ed = MarkdownEditor(val)
            ed.value_changed.connect(lambda t: self._set_leaf(path, t))

            return ed

        ed = MarkdownEditor("" if val is None else str(val))
        ed.value_changed.connect(
            lambda t: self._set_leaf(path, self._coerce_scalar(t)))

        return ed

    @staticmethod
    def _coerce_scalar(t):
        s = t.strip()
        if s == "":
            return ""
        if s.lower() in ("null", "none"):
            return None
        if s.lower() in ("true", "false"):
            return s.lower() == "true"

        try:
            if re.match(r"^-?\d+$", s):
                return int(s)
        except Exception:
            pass

        try:
            if re.match(r"^-?\d+\.\d+$", s):
                return float(s)
        except Exception:
            pass
        return s

    def _pick_new_value(self):
        kind, ok = QInputDialog.getItem(
            self, "Add", "What would you like to add?", self._ADD_CHOICES, 0, False)
        if not ok:
            return None, False

        if kind == "Text":
            txt, ok = QInputDialog.getText(
                self, "Text", "Enter text:", QLineEdit.EchoMode.Normal, "")
            return (txt, True) if ok else (None, False)
        if kind == "Number":
            txt, ok = QInputDialog.getText(
                self, "Number", "Enter a number:", QLineEdit.EchoMode.Normal, "0")
            return (self._coerce_scalar(txt), True) if ok else (None, False)
        if kind == "List":
            return [], True
        if kind == "Section (fields)":
            return {}, True

        return None, False

    def _set_leaf(self, path, new_val):
        if not path:
            self.value = new_val
        else:
            _set_at(self.value, path, new_val)
        self._commit(rebuild = True)

    def _commit(self, rebuild=True):
        self.value_changed.emit(self.value)
        if rebuild:
            self._rebuild_tree()

    def _delete_node(self):
        if not self._current_path:
            QMessageBox.information(
                self, "Delete", "You can't delete the top-level item.")
            return
        if QMessageBox.question(self, "Delete", "Delete this item?") != QMessageBox.StandardButton.Yes:
            return

        _del_at(self.value, self._current_path)
        self._current_path = self._current_path[:-1]
        self._commit(rebuild = True)

    def _move(self, direction):
        if not self._current_path:
            return

        parent_path = self._current_path[:-1]
        last = self._current_path[-1]
        if not isinstance(last, int):
            return

        parent = _get_at(
            self.value, parent_path) if parent_path else self.value
        if not isinstance(parent, list):
            return
        new_idx = last + direction
        if new_idx < 0 or new_idx >= len(parent):
            return

        parent[last], parent[new_idx] = parent[new_idx], parent[last]
        it = self._find_item_by_path(self._current_path)
        if it is None:
            self._current_path = parent_path + (new_idx,)
            self._commit(rebuild = True)

            return

        tree_parent = it.parent()
        container = tree_parent if tree_parent is not None else self.tree.invisibleRootItem()
        moved = container.takeChild(container.indexOfChild(it))
        container.insertChild(new_idx, moved)

        def update_subtree_paths(item, old_prefix, new_prefix):
            ref = item.data(0, Qt.ItemDataRole.UserRole)
            if isinstance(ref, NodeRef) and ref.path[:len(old_prefix)] == old_prefix:
                item.setData(0, Qt.ItemDataRole.UserRole, NodeRef(
                    new_prefix + ref.path[len(old_prefix):]))
            for i in range(item.childCount()):
                update_subtree_paths(item.child(i), old_prefix, new_prefix)

        old_prefix = parent_path + (last,)
        new_prefix = parent_path + (new_idx,)
        update_subtree_paths(moved, old_prefix, new_prefix)

        lo, hi = sorted((last, new_idx))
        for i in range(container.childCount()):
            child = container.child(i)
            ref = child.data(0, Qt.ItemDataRole.UserRole)
            if not (isinstance(ref, NodeRef) and len(ref.path) == len(parent_path) + 1 and
                    ref.path[:len(parent_path)] == parent_path):
                continue

            idx = ref.path[-1]
            if isinstance(idx, int) and lo <= idx <= hi and child is not moved:
                if last < new_idx:
                    if last < idx <= new_idx:
                        update_subtree_paths(
                            child, parent_path + (idx,), parent_path + (idx - 1,))
                else:
                    if new_idx <= idx < last:
                        update_subtree_paths(
                            child, parent_path + (idx,), parent_path + (idx + 1,))

        for i in range(container.childCount()):
            child = container.child(i)
            ref = child.data(0, Qt.ItemDataRole.UserRole)

            if isinstance(ref, NodeRef) and len(ref.path) == len(parent_path) + 1 and \
                    ref.path[:len(parent_path)] == parent_path:
                v = _get_at(self.value, ref.path)
                idx = ref.path[-1]
                label = f"Item {idx + 1}" if isinstance(idx, int) else str(idx)
                child.setText(0, label)
                child.setText(1, summarize(v))

        self._current_path = new_prefix
        self.tree.setCurrentItem(moved)
        self.tree.setFocus(Qt.FocusReason.OtherFocusReason)

        self.value_changed.emit(self.value)
        self._update_action_states()

    def _add_child(self):
        path = self._current_path
        target = self.value if not path else _get_at(self.value, path)

        if not isinstance(target, (dict, list)) and path:
            path = path[:-1]
            target = _get_at(self.value, path) if path else self.value

        if isinstance(target, list):
            self._add_to_list(target)
        elif isinstance(target, dict):
            self._add_to_dict(target)
        else:
            QMessageBox.information(
                self, "Add", "Select a list or a section in the outline to add something.")
            return

    def _add_to_list(self, target_list: list):
        new_val, ok = self._pick_new_value()
        if not ok:
            return

        target_list.insert(0, new_val)
        self._commit(rebuild = True)

    def _add_to_dict(self, target_dict: dict):
        key, ok = QInputDialog.getText(
            self, "Add field", "Field name:", QLineEdit.EchoMode.Normal, "")
        if not ok or not key.strip():
            return
        key = key.strip()

        if key in target_dict:
            QMessageBox.warning(self, "Already exists",
                                "Field already exists.")
            return

        new_val, ok = self._pick_new_value()
        if not ok:
            return

        target_dict[key] = new_val
        self._commit(rebuild = True)
