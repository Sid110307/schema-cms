# schema-cms

> An extensible desktop CMS/editor for structured JS exports, built on [Tauri](https://tauri.app).

schema-cms reads `export const name = ...` declarations from JS data files, gives each one a schema-aware editor, and writes changes back
to only the exports you touched.

## Quick start

Requirements: [Node.js](https://nodejs.org) 20+, [pnpm](https://pnpm.io), [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
pnpm tauri dev                     # runs against ./schema-cms.config.json or env vars in the current directory
pnpm tauri build                   # produces installers in target/release/bundle
```

Try the demo:

```bash
SCHEMA_CMS_CONFIG=examples/demo/schema-cms.config.json pnpm tauri dev
```

Prebuilt binaries are published on the [Releases](../../releases) page for every push to `master` (add `[skip]` to the commit title to
skip a release).

## Configuration

The standalone app looks for configuration in this order:

1. A `.json` path passed as a command-line argument
2. The `SCHEMA_CMS_CONFIG` environment variable
3. `schema-cms.config.json` in the working directory

Relative paths in a config file are resolved against the file's folder. Values missing from the config fall back to environment
variables, then defaults.

| Purpose                 | Config key    | Environment variable           | Default           |
|-------------------------|---------------|--------------------------------|-------------------|
| Data entries directory  | `dataDir`     | `SCHEMA_CMS_DATA_ENTRIES_DIR`  | `.`               |
| Entry file glob         | `entryGlob`   | `SCHEMA_CMS_ENTRY_GLOB`        | `*.js`            |
| Public images directory | `imagesDir`   | `SCHEMA_CMS_PUBLIC_IMAGES_DIR` | `./public/images` |
| Image path prefix in JS | `imagePrefix` | `SCHEMA_CMS_JS_IMAGE_PREFIX`   | `/images/`        |
| App title               | `title`       | `SCHEMA_CMS_APP_TITLE`         | `Schema CMS`      |

A config file also holds `schemas`, `objectSchemas` and `pages`:

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

Without `pages`, every export of every matched file is listed, grouped by file. With `pages`, only those exports are listed, in that order.

## Using schema-cms as a library

An app can embed schema-cms and extend it, the way [ONe Group](https://github.com/Sid110307/ONe-Group/tree/master/ui) does.

`Cargo.toml`:

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

In `tauri.conf.json`, enable the asset protocol (`app.security.assetProtocol.enable: true`) and set `dragDropEnabled: false` on the window.
In the capability file, grant `core:window:allow-destroy`, `core:window:allow-set-title`, `dialog:default` and `schema-cms:default`.

`package.json`:

```json
"dependencies": { "schema-cms": "github:Sid110307/schema-cms" }
```

```ts
import { mount } from "schema-cms";

mount("#root", {
	title: "My CMS",
	paths: { dataDir: "/abs/path/to/data", entryGlob: "*.js", imagesDir: "/abs/path/to/images" },
	imagePrefix: "/images/",
	schemas: { ... },
	objectSchemas: { ... },
	pages: [{ export: "journals", label: "Journals" }],
	labels: (name) => name.toUpperCase(),
	actions: [
		{
			id: "publish",
			label: "Publish",
			icon: "upload",
			async run(ctx) {
				if (!(await ctx.save())) return;
				ctx.setProgress(0, 1, "Publishing…");
				// ...
				ctx.notify("Published", "success");
			},
		},
	],
	editors: { myKind: MyEditor },
});
```

The package ships TypeScript source. Add `optimizeDeps: { exclude: ["schema-cms"] }` to the consuming app's Vite config.

### Custom editors

`editors` maps a schema `kind` to a React component. It receives `exportRef` (`file`, `name`), `value`, `context` (`schema`,
`titleField`, `itemSchema`, `objectSchemas`) and `onChange(newValue)`. Registering a built-in kind overrides the built-in editor.

## Schemas

### Entry schemas

| Property        | Type                     | Applies to        | Description                                                                         |
|-----------------|--------------------------|-------------------|-------------------------------------------------------------------------------------|
| `kind`          | `string`                 | all               | Selects the editor. If omitted, the editor is inferred from the value's type.       |
| `title_field`   | `string`                 | collection, graph | Title shown in the editor.                                                          |
| `item_schema`   | `string`                 | collection, graph | Object schema used for list items. Enables moving entries between compatible lists. |
| `field_schemas` | `Record<string, string>` | graph             | Maps field names to object schemas.                                                 |
| `reverse`       | `boolean`                | collection        | Numbers table rows from the end without changing the data order.                    |

### Object schemas

Map each field name to a type: `string`, `number`, `boolean`, `template` or `image`. A field can also be
`{ "type": "string", "multiline": true }`. `image` fields get a file picker and preview from the images directory.

### Schema kinds

| Kind               | Editor                                                                                               |
|--------------------|------------------------------------------------------------------------------------------------------|
| `document`         | Full-height text editor for template strings, markdown or long text.                                  |
| `collection`       | Searchable table with add, edit, delete, drag-to-reorder and drag-to-move to another page.             |
| `asset_collection` | Media list (images and videos) with previews, file picking and drag-to-reorder.                        |
| `graph`            | Outline of nested objects and lists with a schema-aware detail panel.                                  |

Without a matching `kind`, strings open in the text editor and objects or lists open in the graph editor.

### Moving entries

Drag a row from a table or outline onto a highlighted page in the sidebar, or use **Move to…**, to move it into any list that uses the
same `item_schema`. Changes are kept in memory until you save (Ctrl+S).

## License

> [MIT](https://opensource.org/licenses/MIT)
