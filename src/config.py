import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class _Config:
    public_images_dir: Path | None = None
    js_image_prefix: str | None = None
    app_title: str | None = None
    entry_glob: str | None = None
    data_entries_dir: Path | None = None


CONFIG = _Config()


def get_public_images_dir() -> Path:
    if CONFIG.public_images_dir is not None:
        return CONFIG.public_images_dir

    env_value = os.getenv("SCHEMA_CMS_PUBLIC_IMAGES_DIR")
    if env_value:
        return Path(env_value)

    return Path.cwd() / "public" / "images"


def set_public_images_dir(path) -> None:
    CONFIG.public_images_dir = Path(path)


def get_js_image_prefix() -> str:
    if CONFIG.js_image_prefix is not None:
        return CONFIG.js_image_prefix

    env_value = os.getenv("SCHEMA_CMS_JS_IMAGE_PREFIX")
    if env_value:
        return env_value

    return "/images/"


def set_js_image_prefix(prefix: str) -> None:
    CONFIG.js_image_prefix = str(prefix)


def get_app_title() -> str:
    if CONFIG.app_title is not None:
        return CONFIG.app_title

    env_value = os.getenv("SCHEMA_CMS_APP_TITLE")
    if env_value:
        return env_value

    return "Schema CMS"


def set_app_title(title: str) -> None:
    CONFIG.app_title = str(title)


def get_entry_glob() -> str:
    if CONFIG.entry_glob is not None:
        return CONFIG.entry_glob

    env_value = os.getenv("SCHEMA_CMS_ENTRY_GLOB")
    if env_value:
        return env_value

    return "*.js"


def set_entry_glob(pattern: str) -> None:
    CONFIG.entry_glob = str(pattern)


def get_data_entries_dir() -> Path:
    if CONFIG.data_entries_dir is not None:
        return CONFIG.data_entries_dir

    env_value = os.getenv("SCHEMA_CMS_DATA_ENTRIES_DIR")
    if env_value:
        return Path(env_value)

    return Path.cwd()


def set_data_entries_dir(path) -> None:
    CONFIG.data_entries_dir = Path(path)
