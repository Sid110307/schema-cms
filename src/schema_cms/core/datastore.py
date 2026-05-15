from dataclasses import dataclass
from pathlib import Path

from .js_exports import JSTemplate, parse_exports, replace_export_value
from ..config import get_entry_glob


@dataclass(frozen = True)
class ExportRef:
    file_path: Path
    export_name: str


@dataclass
class _Blob:
    text: str
    exports: dict
    spans: dict
    dirty_exports: set


class DataStore:
    def __init__(self, data_entries_dir):
        self.data_entries_dir = Path(data_entries_dir)
        self._files = {}

    def list_files(self):
        return sorted(self.data_entries_dir.glob(get_entry_glob()))

    def has_unsaved(self):
        return any(bool(blob.dirty_exports) for blob in self._files.values())

    def _ensure_loaded(self, path):
        path = Path(path)
        if path in self._files:
            return self._files[path]

        try:
            text = path.read_text(encoding = "utf-8")
            exports, spans_list = parse_exports(text)
            spans = {s.name: s for s in spans_list}

            blob = _Blob(
                text = text,
                exports = exports,
                spans = spans,
                dirty_exports = set(),
            )

            self._files[path] = blob
            return blob
        except Exception as e:
            raise RuntimeError(f"Failed to load data file: {path}") from e

    def load_file(self, path):
        blob = self._ensure_loaded(path)
        return blob.exports

    def get(self, ref):
        blob = self._ensure_loaded(ref.file_path)
        if ref.export_name not in blob.exports:
            raise KeyError(f"Export \"{ref.export_name}\" not found in {ref.file_path}")
        return blob.exports[ref.export_name]

    def set(self, ref, value):
        blob = self._ensure_loaded(ref.file_path)
        exports = blob.exports

        old = exports.get(ref.export_name)
        if isinstance(old, JSTemplate) and isinstance(value, str):
            value = JSTemplate(value)

        if isinstance(value, (list, dict)):
            exports[ref.export_name] = value
            blob.dirty_exports.add(ref.export_name)
            return

        if old == value:
            return

        exports[ref.export_name] = value
        blob.dirty_exports.add(ref.export_name)

    def save_file(self, path):
        blob = self._ensure_loaded(path)
        if not blob.dirty_exports:
            return False

        text = blob.text
        spans = blob.spans
        exports = blob.exports

        dirty_names = [n for n in blob.dirty_exports if n in spans]
        dirty_names.sort(key = lambda n: spans[n].init_start, reverse = True)

        for name in dirty_names:
            text = replace_export_value(text, spans[name], exports[name])
        Path(path).write_text(text, encoding = "utf-8")

        new_text = text
        new_exports, new_spans_list = parse_exports(new_text)

        blob.text = new_text
        blob.exports = new_exports
        blob.spans = {s.name: s for s in new_spans_list}
        blob.dirty_exports.clear()

        return True

    def save_all(self):
        saved = []
        for path, blob in list(self._files.items()):
            if blob.dirty_exports:
                if self.save_file(path):
                    saved.append(path)
        return saved
