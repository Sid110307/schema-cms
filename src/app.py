import sys
from pathlib import Path

from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import QApplication, QStyleFactory

from .config import get_app_title, get_data_entries_dir
from .core.datastore import DataStore
from .ui.main_window import MainWindow
from .ui.theme import apply_palette, apply_stylesheet


def _resolve_data_entries_dir(value):
    if value:
        return Path(value)
    return get_data_entries_dir()


def main(argv=None, data_entries_dir=None, window_factory=None):
    args = list(sys.argv if argv is None else argv)

    app = QApplication(args)
    app.setStyle(QStyleFactory.create("Fusion"))

    apply_palette(app)
    apply_stylesheet(app)
    QGuiApplication.styleHints().colorSchemeChanged.connect(lambda _: apply_palette(app))

    store = DataStore(_resolve_data_entries_dir(data_entries_dir))
    w = MainWindow(store, title = get_app_title()) if window_factory is None else window_factory(store,
                                                                                                 title = get_app_title())
    w.resize(1300, 850)
    w.setMinimumSize(1000, 650)
    w.show()

    return app.exec()
