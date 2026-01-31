from pathlib import Path

from PySide6.QtCore import QRectF, QStandardPaths, QUrl, Qt, Signal
from PySide6.QtGui import QPainter, QPainterPath, QPixmap
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtMultimediaWidgets import QVideoWidget
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkDiskCache, QNetworkRequest
from PySide6.QtWidgets import QFileDialog, QHBoxLayout, QLabel, QLineEdit, QListWidget, QListWidgetItem, QMessageBox, \
    QVBoxLayout, QWidget

from ..icons import icon_button
from ...config import get_public_images_dir
from ...core.js_exports import js_to_local_path, local_to_js_path

IMAGE_EXTS = {".webp", ".png", ".jpg", ".jpeg"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v"}


def pick_images(parent, title):
    start_dir = get_public_images_dir().resolve()
    files, _ = QFileDialog.getOpenFileNames(parent, title, str(start_dir),
                                            f"Media (*{' *'.join(IMAGE_EXTS | VIDEO_EXTS)})")
    if not files:
        return [], []

    out = []
    bad = []
    for f in files:
        js = local_to_js_path(f)
        if not js:
            bad.append(f)
            continue
        out.append(js)

    return out, bad


class ImagePreview(QLabel):
    def __init__(self, radius=12, min_size=(128, 128), parent=None):
        super().__init__(parent)

        self._radius = radius
        self._last_js_path: str | None = None
        self._nam = QNetworkAccessManager(self)
        self._reply = None
        self._source_pix: QPixmap | None = None
        self._cache: dict[str, QPixmap] = {}

        disk = QNetworkDiskCache(self)
        disk.setCacheDirectory(str((Path(
            QStandardPaths.writableLocation(QStandardPaths.StandardLocation.CacheLocation)) / "schema-cms").resolve()))
        disk.setMaximumCacheSize(64 * 1024 * 1024)
        self._nam.setCache(disk)

        self.setObjectName("accent")
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setMinimumSize(*min_size)
        self.setText("No image")

    def clear_preview(self, text="No image"):
        self._last_js_path = None
        self._source_pix = None
        self.setText(text)
        self.setPixmap(QPixmap())

    def set_js_path(self, js_path: str | None):
        if self._last_js_path == js_path and self._source_pix and not self._source_pix.isNull():
            self._render_from_source()
            return
        self._last_js_path = js_path

        if not js_path:
            self.clear_preview("No image")
            return

        if js_path in self._cache:
            self._source_pix = self._cache[js_path]
            self._render_from_source()
            return

        if js_path.lower().startswith(("http://", "https://")):
            self.setText("Loading...")
            if self._reply is not None:
                old = self._reply
                self._reply = None

                old.abort()
                old.deleteLater()

            req = QNetworkRequest(QUrl(js_path))
            req.setHeader(QNetworkRequest.KnownHeaders.UserAgentHeader, "SchemaCMS/1.0")
            reply = self._nam.get(req)
            self._reply = reply
            reply.finished.connect(lambda r=reply, p=js_path: self._on_image_downloaded(r, p))

            return

        local = js_to_local_path(js_path)
        if not local or not local.exists():
            self.clear_preview("Not found")
            return

        pix = QPixmap(str(local))
        self._source_pix = pix
        self._render_from_source()

    def _set_pixmap(self, pix: QPixmap):
        if pix.isNull():
            self.clear_preview("Invalid image")
            return

        dpr = self.devicePixelRatioF()
        target = self.size() * dpr
        scaled = pix.scaled(target, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)

        rounded = QPixmap(scaled.size())
        rounded.setDevicePixelRatio(dpr)
        rounded.fill(Qt.GlobalColor.transparent)

        painter = QPainter(rounded)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        path = QPainterPath()
        path.addRoundedRect(QRectF(0, 0, scaled.width(), scaled.height()), self._radius * dpr, self._radius * dpr)
        painter.setClipPath(path)
        painter.drawPixmap(0, 0, scaled)
        painter.end()

        self.clear()
        self.setPixmap(rounded)

    def _render_from_source(self):
        if not self._source_pix or self._source_pix.isNull():
            self.clear_preview("Invalid image")
            return
        self._set_pixmap(self._source_pix)

    def _on_image_downloaded(self, reply, js_path):
        if reply is None:
            return
        if self._reply is not reply:
            reply.deleteLater()
            return

        self._reply = None
        if reply.error() != reply.NetworkError.NoError:
            reply.deleteLater()
            if self._last_js_path == js_path:
                self.clear_preview("Failed to load image")
            return

        if not reply.isOpen():
            reply.deleteLater()
            if self._last_js_path == js_path:
                self.clear_preview("Failed to load image")
            return

        data = bytes(reply.readAll())
        reply.deleteLater()
        if self._last_js_path != js_path:
            return

        pix = QPixmap()
        if not pix.loadFromData(data):
            self.clear_preview("Invalid image")
            return

        self._source_pix = pix
        self._cache[js_path] = pix
        self._render_from_source()


class ImagePicker(QWidget):
    value_changed = Signal(str)

    def __init__(self, value="", radius=12):
        super().__init__()

        self.btn = icon_button("edit", tooltip = "Pick image")
        self.edit = QLineEdit("" if value is None else str(value))
        self.preview = ImagePreview(radius = radius)

        row = QHBoxLayout()
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(6)
        row.addWidget(self.edit, 1)
        row.addWidget(self.btn)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(6)
        lay.addLayout(row)
        lay.addWidget(self.preview, 0, Qt.AlignmentFlag.AlignCenter)

        self.edit.textChanged.connect(self._on_text_changed)
        self.btn.clicked.connect(self._pick)

        self._on_text_changed()

    def _on_text_changed(self):
        val = self.edit.text().strip()
        self.preview.set_js_path(val)
        self.value_changed.emit(val)

    def _pick(self):
        js_paths, _ = pick_images(self, "Choose image")
        if js_paths:
            self.edit.setText(js_paths[0])

    def text(self):
        return self.edit.text().strip()

    def setText(self, t):
        self.edit.setText("" if t is None else str(t))

    def value(self):
        return self.text()


class VideoWidget(QVideoWidget):
    clicked = Signal()

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit()
            e.accept()

            return
        super().mousePressEvent(e)


class MediaListEditor(QWidget):
    value_changed = Signal(list)

    def __init__(self, value):
        super().__init__()

        self.value = value
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(12)

        left = QVBoxLayout()
        left.setSpacing(10)
        root.addLayout(left, 2)
        left.addWidget(QLabel("Media"))

        self.list = QListWidget()
        self.list.setSelectionMode(QListWidget.SelectionMode.SingleSelection)
        self.list.setDragDropMode(QListWidget.DragDropMode.InternalMove)
        self.list.model().rowsMoved.connect(lambda *_: self._sync_from_list())
        left.addWidget(self.list, 1)

        btns = QHBoxLayout()
        btns.setSpacing(6)

        self.btn_add = icon_button("add", tooltip = "Add media")
        self.btn_del = icon_button("delete", tooltip = "Delete selected media")
        self.btn_up = icon_button("up", tooltip = "Move selected media up")
        self.btn_dn = icon_button("down", tooltip = "Move selected media down")

        btns.addWidget(self.btn_add)
        btns.addWidget(self.btn_del)
        btns.addStretch(1)
        btns.addWidget(self.btn_up)
        btns.addWidget(self.btn_dn)
        left.addLayout(btns)

        self.btn_add.clicked.connect(self.add_media)
        self.btn_del.clicked.connect(self.delete_selected)
        self.btn_up.clicked.connect(self.move_up)
        self.btn_dn.clicked.connect(self.move_down)

        right = QVBoxLayout()
        right.setSpacing(6)
        root.addLayout(right, 3)

        right.addWidget(QLabel("Preview"))

        self.image_preview = ImagePreview(radius = 12, min_size = (300, 300))
        self.image_preview.clear_preview("Select an item to preview")

        self.video_preview = VideoWidget()
        self.video_preview.setMinimumHeight(300)
        self.video_preview.setAspectRatioMode(Qt.AspectRatioMode.KeepAspectRatio)
        self.video_preview.hide()
        self.video_preview.clicked.connect(self._toggle_video)

        right.addWidget(self.image_preview, 1)
        right.addWidget(self.video_preview, 1)

        self.media_player = QMediaPlayer(self)
        self.audio_output = QAudioOutput(self)
        self.media_player.setAudioOutput(self.audio_output)
        self.media_player.setVideoOutput(self.video_preview)

        self.path_label = QLabel("")
        right.addWidget(self.path_label)

        self.list.currentItemChanged.connect(self._render_preview)
        self._populate()

    def _populate(self):
        self.list.clear()
        for s in self.value:
            it = QListWidgetItem(Path(s).name)
            it.setData(Qt.ItemDataRole.UserRole, s)
            self.list.addItem(it)

        if self.list.count():
            self.list.setCurrentRow(0)

    def _sync_from_list(self):
        self.value[:] = [self.list.item(i).data(Qt.ItemDataRole.UserRole) for i in range(self.list.count())]
        self.value_changed.emit(self.value)

    def _render_preview(self, item, _):
        self.media_player.stop()
        self.video_preview.hide()
        self.image_preview.show()

        row = self.list.currentRow()
        self.btn_up.setEnabled(row > 0)
        self.btn_dn.setEnabled(0 <= row < self.list.count() - 1)

        if not item:
            self.image_preview.clear_preview("Select an item to preview")
            self.path_label.setText("")
            return

        js_path = item.data(Qt.ItemDataRole.UserRole)
        if js_path.lower().startswith(("http://", "https://")):
            suffix = Path(js_path.split("?", 1)[0].split("#", 1)[0]).suffix.lower()
            self.path_label.setText(js_path)

            if suffix in VIDEO_EXTS:
                self.image_preview.hide()
                self.video_preview.show()
                self.media_player.setSource(QUrl(js_path))
                self.media_player.setLoops(QMediaPlayer.Loops.Infinite)
                self.media_player.play()

                return

            if suffix in IMAGE_EXTS:
                self.image_preview.set_js_path(js_path)
                return

            self.image_preview.clear_preview("Preview not available")
            return

        local = js_to_local_path(js_path)
        self.path_label.setText(str(local) if local else js_path)

        if not local or not local.exists():
            self.image_preview.clear_preview("Preview not available")
            return

        if local.suffix.lower() in IMAGE_EXTS:
            self.image_preview.set_js_path(js_path)
        elif local.suffix.lower() in VIDEO_EXTS:
            self.image_preview.hide()
            self.video_preview.show()
            self.media_player.setSource(QUrl.fromLocalFile(str(local)))
            self.media_player.setLoops(QMediaPlayer.Loops.Infinite)
            self.media_player.play()

    def _toggle_video(self):
        if self.media_player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.media_player.pause()
        else:
            self.media_player.play()

    def resizeEvent(self, e):
        super().resizeEvent(e)
        if item := self.list.currentItem():
            self._render_preview(item, None)

    def hideEvent(self, e):
        super().hideEvent(e)
        self.media_player.stop()

    def add_media(self):
        js_paths, bad = pick_images(self, "Add media")
        if not js_paths and not bad:
            return
        for js in reversed(js_paths):
            self.value.insert(0, js)

        self._populate()
        self.value_changed.emit(self.value)

        if bad:
            QMessageBox.warning(self, "Some files were skipped",
                                f"These files are not under {get_public_images_dir()}:\n\n" + "\n".join(bad), )

    def delete_selected(self):
        row = self.list.currentRow()
        if row < 0:
            return
        if QMessageBox.question(self, "Delete", "Delete selected item?") != QMessageBox.StandardButton.Yes:
            return

        self.value.pop(row)
        self._populate()
        self.value_changed.emit(self.value)

    def move_up(self):
        row = self.list.currentRow()
        if row <= 0:
            return

        self.value[row - 1], self.value[row] = self.value[row], self.value[row - 1]
        item = self.list.takeItem(row)
        self.list.insertItem(row - 1, item)
        self.list.setCurrentRow(row - 1)
        self.list.setFocus(Qt.FocusReason.OtherFocusReason)
        self._render_preview(self.list.currentItem(), None)
        self.value_changed.emit(self.value)

    def move_down(self):
        row = self.list.currentRow()
        if row < 0 or row >= self.list.count() - 1:
            return

        self.value[row + 1], self.value[row] = self.value[row + 1], self.value[row]
        item = self.list.takeItem(row)
        self.list.insertItem(row + 1, item)
        self.list.setCurrentRow(row + 1)
        self.list.setFocus(Qt.FocusReason.OtherFocusReason)
        self._render_preview(self.list.currentItem(), None)
        self.value_changed.emit(self.value)
