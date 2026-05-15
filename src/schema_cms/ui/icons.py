from pathlib import Path

from PySide6.QtCore import QSize, Qt
from PySide6.QtGui import QColor, QIcon, QPainter, QPalette, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import QApplication, QPushButton

ICON_DIR = Path(__file__).resolve().parent / "icons"
ICON_MAP = {
    "add":    ["add.svg", QPalette.ColorRole.Text],
    "edit":   ["edit.svg", QPalette.ColorRole.Text],
    "delete": ["delete.svg", QPalette.ColorRole.BrightText],
    "up":     ["up.svg", QPalette.ColorRole.Text],
    "down":   ["down.svg", QPalette.ColorRole.Text],
}
_ICON_CACHE = {}


def invalidate_icon_cache():
    _ICON_CACHE.clear()

def _resolve_color(role, widget=None):
    try:
        pal = widget.palette() if widget is not None else QApplication.palette()
        return pal.color(QPalette.ColorGroup.Active, role)
    except Exception:
        return QColor(0, 0, 0)


def svg_icon(name, size, widget=None):
    if name not in ICON_MAP:
        raise ValueError(f"Unknown icon name: {name}")

    svg_name, role = ICON_MAP[name]
    color = _resolve_color(role, widget)

    key = (name, int(color.rgba()), size)
    if key in _ICON_CACHE:
        return _ICON_CACHE[key]

    path = ICON_DIR / svg_name
    if not path.exists():
        raise FileNotFoundError(path)

    renderer = QSvgRenderer(str(path))
    pix = QPixmap(size[0], size[1])
    pix.fill(Qt.GlobalColor.transparent)

    painter = QPainter(pix)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)
    renderer.render(painter, pix.rect())
    painter.setCompositionMode(
        QPainter.CompositionMode.CompositionMode_SourceIn)
    painter.fillRect(pix.rect(), color)
    painter.end()

    icon = QIcon(pix)
    _ICON_CACHE[key] = icon

    return icon


def icon_button(name, *, text="", tooltip="", size=(34, 30)):
    pad = (16, 8) if name == "delete" else (12, 4)
    icon_size = (size[0] - pad[0], size[1] - pad[1])

    btn = QPushButton()
    btn.setIcon(svg_icon(name, icon_size))
    btn.setIconSize(QSize(icon_size[0], icon_size[1]))
    btn.setText(f" {text or name.capitalize()}")
    btn.setMinimumWidth(size[0])
    btn.setFixedHeight(size[1])
    btn.setToolTip(tooltip)
    btn.setCursor(Qt.CursorShape.PointingHandCursor)

    return btn
