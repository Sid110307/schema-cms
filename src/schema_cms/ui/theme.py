from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QGuiApplication, QPalette


def _c(h):
    return QColor(h)


def is_dark():
    return QGuiApplication.styleHints().colorScheme() == Qt.ColorScheme.Dark


def apply_stylesheet(app):
    app.setStyleSheet(
        """
        QWidget {
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell;
            font-size: 13px;
        }
        
        QPushButton {
            border: 1px solid palette(midlight);
            background: palette(button);
            color: palette(buttonText);
            border-radius: 12px;
            padding: 4px 12px;
        }
        
        QPushButton:hover {
            background: palette(midlight);
        }
        
        QPushButton:pressed {
            background: palette(mid);
        }
        
        QPushButton:disabled {
            background: palette(window);
            color: palette(mid);
            border-color: palette(midlight);
        }
        
        QLabel {
            color: palette(windowText);
            border-radius: 12px;
        }
        
        QLabel#accent {
            border: 1px solid palette(midlight);
        }
        
        QLineEdit, QPlainTextEdit {
            border: 1px solid palette(midlight);
            background: palette(base);
            color: palette(text);
            border-radius: 14px;
            padding: 9px 12px;
            selection-background-color: palette(highlight);
            selection-color: palette(highlightedText);
        }
        
        QLineEdit:hover, QPlainTextEdit:hover {
            border-color: palette(mid);
        }
        
        QLineEdit:focus, QPlainTextEdit:focus {
            border-color: palette(highlight);
        }
        
        QListWidget:focus, QTreeWidget:focus, QTableView:focus {
            outline: none;
        }
        
        QListWidget::item:focus, QTreeWidget::item:focus, QTableView::item:focus {
            outline: none;
            border: none;
        }
        
        QListWidget, QTreeWidget, QTableView {
            border: 1px solid palette(midlight);
            background: palette(base);
            border-radius: 16px;
        }
        
        QListWidget::viewport, QTreeWidget::viewport, QTableView::viewport {
            background: palette(base);
            border-radius: 16px;
        }
        
        QListWidget::item, QTreeWidget::item, QTableView::item {
            padding: 9px 10px;
        }
        
        QListWidget::item:hover, QTreeWidget::item:hover, QTableView::item:hover {
            background: palette(light);
        }
        
        QListWidget::item:selected, QTreeWidget::item:selected {
            background-color: palette(highlight);
            color: palette(highlightedText);
        }
        
        QTableView::item:selected {
            background-color: palette(highlight);
            color: palette(highlightedText);
        }
        
        QTableCornerButton::section {
            background: transparent;
            border: none;
        }
        
        QVideoWidget {
            background: palette(mid);
            border-radius: 12px;
        }
        
        QHeaderView {
            background: transparent;
            border: none;
        }
        
        QHeaderView::section {
            border: none;
            border-bottom: 1px solid palette(midlight);
            background: palette(window);
            padding: 10px 10px;
            font-weight: 650;
            color: palette(windowText);
        }
        
        QToolTip {
            background: palette(window);
            color: palette(windowText);
            border: 1px solid palette(midlight);
        }
        
        QScrollBar:vertical {
            background: transparent;
            width: 10px;
            margin: 2px;
        }
        
        QScrollBar:horizontal {
            background: transparent;
            height: 10px;
            margin: 2px;
        }
        
        QScrollBar::add-page, QScrollBar::sub-page {
            background: transparent;
        }
        
        QScrollBar::handle:vertical {
            background: palette(mid);
            min-height: 24px;
            border-radius: 12px;
        }
        
        QScrollBar::handle:horizontal {
            background: palette(mid);
            min-width: 24px;
            border-radius: 12px;
        }
        
        QScrollBar::handle:vertical:hover, QScrollBar::handle:horizontal:hover {
            background: palette(midlight);
        }
        
        QScrollBar::handle:vertical:pressed, QScrollBar::handle:horizontal:pressed {
            background: palette(text);
        }
        
        QScrollBar::add-line, QScrollBar::sub-line {
            width: 0px;
            height: 0px;
            background: none;
            border: none;
        }
        
        QScrollBar::corner {
            background: transparent;
        }
       """
    )


def light_palette():
    p = QPalette()
    p.setColor(QPalette.ColorRole.Window, QColor("#f0f2f7"))
    p.setColor(QPalette.ColorRole.Base, QColor("#ffffff"))
    p.setColor(QPalette.ColorRole.AlternateBase, QColor("#e8ebf0"))
    p.setColor(QPalette.ColorRole.WindowText, QColor("#1c1c1e"))
    p.setColor(QPalette.ColorRole.Text, QColor("#1c1c1e"))
    p.setColor(QPalette.ColorRole.ButtonText, QColor("#000000"))
    p.setColor(QPalette.ColorRole.PlaceholderText, QColor("#6b6b73"))
    p.setColor(QPalette.ColorRole.Button, QColor("#e1e4ea"))
    p.setColor(QPalette.ColorRole.Light, QColor("#f5f7fb"))
    p.setColor(QPalette.ColorRole.Midlight, QColor("#d6d9e1"))
    p.setColor(QPalette.ColorRole.Mid, QColor("#b0b4bd"))
    p.setColor(QPalette.ColorRole.Dark, QColor("#8e929b"))
    p.setColor(QPalette.ColorRole.Shadow, QColor("#000000"))
    p.setColor(QPalette.ColorRole.Highlight, QColor("#007aff"))
    p.setColor(QPalette.ColorRole.HighlightedText, QColor("#ffffff"))
    p.setColor(QPalette.ColorRole.Link, QColor("#0066ff"))
    p.setColor(QPalette.ColorRole.LinkVisited, QColor("#004ecc"))
    p.setColor(QPalette.ColorRole.ToolTipBase, QColor("#f0f2f7"))
    p.setColor(QPalette.ColorRole.ToolTipText, QColor("#1c1c1e"))
    p.setColor(QPalette.ColorRole.BrightText, QColor("#ff3b30"))

    return p


def dark_palette():
    p = QPalette()
    p.setColor(QPalette.ColorRole.Window, QColor("#121216"))
    p.setColor(QPalette.ColorRole.Base, QColor("#1e1e22"))
    p.setColor(QPalette.ColorRole.AlternateBase, QColor("#2c2c30"))
    p.setColor(QPalette.ColorRole.WindowText, QColor("#f0f0f3"))
    p.setColor(QPalette.ColorRole.Text, QColor("#f0f0f3"))
    p.setColor(QPalette.ColorRole.ButtonText, QColor("#ffffff"))
    p.setColor(QPalette.ColorRole.PlaceholderText, QColor("#8e8e93"))
    p.setColor(QPalette.ColorRole.Button, QColor("#2c2c30"))
    p.setColor(QPalette.ColorRole.Light, QColor("#3a3a3e"))
    p.setColor(QPalette.ColorRole.Midlight, QColor("#48484c"))
    p.setColor(QPalette.ColorRole.Mid, QColor("#636366"))
    p.setColor(QPalette.ColorRole.Dark, QColor("#787880"))
    p.setColor(QPalette.ColorRole.Shadow, QColor("#000000"))
    p.setColor(QPalette.ColorRole.Highlight, QColor("#0a84ff"))
    p.setColor(QPalette.ColorRole.HighlightedText, QColor("#000000"))
    p.setColor(QPalette.ColorRole.Link, QColor("#3794ff"))
    p.setColor(QPalette.ColorRole.LinkVisited, QColor("#5e9cff"))
    p.setColor(QPalette.ColorRole.ToolTipBase, QColor("#1e1e22"))
    p.setColor(QPalette.ColorRole.ToolTipText, QColor("#f0f0f3"))
    p.setColor(QPalette.ColorRole.BrightText, QColor("#ff453a"))

    return p


def apply_palette(app):
    app.setPalette(dark_palette() if is_dark() else light_palette())
