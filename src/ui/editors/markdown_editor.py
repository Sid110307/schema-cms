from PySide6.QtCore import Signal
from PySide6.QtWidgets import QLabel, QPlainTextEdit, QVBoxLayout, QWidget


class MarkdownEditor(QWidget):
    value_changed = Signal(str)

    def __init__(self, value):
        super().__init__()

        self._value = value
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(10)

        title = QLabel("Text")
        root.addWidget(title)

        self.edit = QPlainTextEdit()
        self.edit.setPlainText(value or "")
        self.edit.setLineWrapMode(QPlainTextEdit.LineWrapMode.WidgetWidth)
        root.addWidget(self.edit, 1)
        self.edit.textChanged.connect(self._apply)

    def _apply(self):
        self._value = self.edit.toPlainText()
        self.value_changed.emit(self._value)
