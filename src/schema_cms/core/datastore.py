import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .js_exports import JSRaw, JSTemplate, parse_exports, replace_export_value
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
        if isinstance(value, str):
            if isinstance(old, JSTemplate):
                value = JSTemplate(value)
            elif isinstance(old, JSRaw):
                value = JSRaw(value)

        if isinstance(value, (list, dict)):
            exports[ref.export_name] = value
            blob.dirty_exports.add(ref.export_name)
            return

        if old == value:
            return

        exports[ref.export_name] = value
        blob.dirty_exports.add(ref.export_name)

    def move_item(self, source_ref, source_path, row, destination_ref, destination_path):
        if source_ref == destination_ref and tuple(source_path) == tuple(destination_path):
            raise ValueError("Choose a different destination list")

        source = self.get(source_ref)
        destination = self.get(destination_ref)
        for key in source_path:
            source = source[key]
        for key in destination_path:
            destination = destination[key]

        if not isinstance(source, list) or not isinstance(destination, list):
            raise ValueError("Both locations must be lists")
        if not 0 <= row < len(source):
            raise IndexError("The selected item is no longer available")

        destination.insert(0, source.pop(row))
        self.set(source_ref, self.get(source_ref))
        if destination_ref != source_ref:
            self.set(destination_ref, self.get(destination_ref))

    def save_file(self, path):
        blob = self._ensure_loaded(path)
        if not blob.dirty_exports:
            return False

        self._save_paths([Path(path)])
        return True

    @staticmethod
    def _temp_path(path):
        fd, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        os.close(fd)
        return Path(name)

    def _save_paths(self, paths):
        prepared = []
        temporary_paths = []
        replaced = []
        failed_backups = set()

        try:
            for path in paths:
                blob = self._ensure_loaded(path)
                text = blob.text
                dirty_names = [name for name in blob.dirty_exports if name in blob.spans]
                dirty_names.sort(key=lambda name: blob.spans[name].init_start, reverse=True)
                for name in dirty_names:
                    text = replace_export_value(text, blob.spans[name], blob.exports[name])

                exports, spans_list = parse_exports(text)
                staged = self._temp_path(path)
                temporary_paths.append(staged)
                staged.write_text(text, encoding="utf-8")
                shutil.copymode(path, staged)

                backup = self._temp_path(path)
                temporary_paths.append(backup)
                shutil.copy2(path, backup)
                prepared.append((path, blob, text, exports, spans_list, staged, backup))

            for item in prepared:
                os.replace(item[5], item[0])
                replaced.append(item)
        except Exception as exc:
            for item in reversed(replaced):
                try:
                    os.replace(item[6], item[0])
                except Exception:
                    failed_backups.add(item[6])
            if failed_backups:
                locations = ", ".join(str(path) for path in failed_backups)
                raise RuntimeError(f"Save failed and rollback failed; backups remain at: {locations}") from exc
            raise
        else:
            for path, blob, text, exports, spans_list, _, _ in prepared:
                blob.text = text
                blob.exports = exports
                blob.spans = {span.name: span for span in spans_list}
                blob.dirty_exports.clear()
        finally:
            for path in temporary_paths:
                if path not in failed_backups:
                    try:
                        path.unlink(missing_ok=True)
                    except OSError:
                        pass

    def save_all(self):
        paths = [path for path, blob in self._files.items() if blob.dirty_exports]
        if paths:
            self._save_paths(paths)
        return paths
