# schema-cms

> A desktop editor for structured JS data files, built on [Tauri](https://tauri.app).

## Setup

Requirements: [Node.js](https://nodejs.org) 20+, [pnpm](https://pnpm.io), [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
pnpm tauri dev
pnpm tauri build
```

Demo:

```bash
SCHEMA_CMS_CONFIG=examples/demo/schema-cms.config.json pnpm tauri dev
```

Builds are on the [Releases](../../releases) page.

## Configuration

Pass a config file as an argument, set `SCHEMA_CMS_CONFIG`, or put `schema-cms.config.json` in the working directory.

| Setting                 | Config key    | Environment variable           | Default           |
|-------------------------|---------------|--------------------------------|-------------------|
| Data entries directory  | `dataDir`     | `SCHEMA_CMS_DATA_ENTRIES_DIR`  | `.`               |
| Entry file glob         | `entryGlob`   | `SCHEMA_CMS_ENTRY_GLOB`        | `*.js`            |
| Public images directory | `imagesDir`   | `SCHEMA_CMS_PUBLIC_IMAGES_DIR` | `./public/images` |
| Image path prefix in JS | `imagePrefix` | `SCHEMA_CMS_JS_IMAGE_PREFIX`   | `/images/`        |
| App title               | `title`       | `SCHEMA_CMS_APP_TITLE`         | `Schema CMS`      |

```json
{
	"title": "My CMS",
	"dataDir": "./src/data",
	"imagesDir": "./public/images",
	"imagePrefix": "/images/",
	"schemas": {
		"content": { "kind": "document" },
		"journals": { "kind": "collection", "item_schema": "publication", "title_field": "Journals", "reverse": true }
	},
	"objectSchemas": {
		"publication": { "title": "string", "year": "number", "cover": "image" }
	},
	"pages": [
		{ "export": "content", "label": "Home Page" },
		{ "export": "journals", "label": "Journals" }
	]
}
```

`pages` sets which exports are listed and in what order. Without it, every export is listed.

## Schemas

| Property        | Applies to        | Description                                       |
|-----------------|-------------------|---------------------------------------------------|
| `kind`          | all               | `document`, `collection`, `asset_collection` or `graph`. Inferred if omitted. |
| `title_field`   | collection, graph | Title shown in the editor.                        |
| `item_schema`   | collection, graph | Object schema for list items.                     |
| `field_schemas` | graph             | Object schemas for specific fields.               |
| `reverse`       | collection        | Number rows from the end.                         |

Object schemas map each field to `string`, `number`, `boolean`, `template` or `image`, or to
`{ "type": "string", "multiline": true }`.

## Embedding

```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-dialog = "2"
tauri-plugin-schema-cms = { git = "https://github.com/Sid110307/schema-cms" }
```

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_schema_cms::init())
```

Enable the asset protocol and set `dragDropEnabled: false` on the window in `tauri.conf.json`, and grant `core:window:allow-destroy`,
`core:window:allow-set-title`, `dialog:default` and `schema-cms:default`.

```json
"dependencies": { "schema-cms": "github:Sid110307/schema-cms" }
```

```ts
import { mount } from "schema-cms";

mount("#root", {
	title: "My CMS",
	paths: { dataDir: "/abs/path/to/data", entryGlob: "*.js", imagesDir: "/abs/path/to/images" },
	schemas: { ... },
	objectSchemas: { ... },
	pages: [{ export: "journals", label: "Journals" }],
	actions: [{ id: "publish", label: "Publish", icon: "upload", run: async (ctx) => { ... } }],
	editors: { myKind: MyEditor },
});
```

Vite config:

```ts
optimizeDeps: {
	include: ["react-dom/client", "schema-cms > acorn", "schema-cms > @tauri-apps/api/core", "schema-cms > @tauri-apps/api/window"],
},
```

## License

> [MIT](https://opensource.org/licenses/MIT)
