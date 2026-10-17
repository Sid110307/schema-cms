import type { ComponentType } from "react";

import { type EntrySchema, type ObjectSchema, schemaFor } from "../core/schema";
import type { ExportRef } from "../core/store";
import { type JSValue, JSRaw, JSTemplate, isObject } from "../core/values";
import type { EditorProps, MoveRequest } from "../types";
import { DocumentEditor } from "./editors/DocumentEditor";
import { GraphEditor } from "./editors/GraphEditor";
import { MediaListEditor } from "./editors/MediaListEditor";
import { TableEditor } from "./editors/TableEditor";

interface Props {
	exportRef: ExportRef;
	value: JSValue;
	label: string;
	schemas: Record<string, EntrySchema>;
	objectSchemas: Record<string, ObjectSchema>;
	editors: Record<string, ComponentType<EditorProps>>;
	onChange: (v: JSValue) => void;
	onMove: (sourcePath: readonly (string | number)[], row: number, itemSchema: string | undefined) => void;
}

export function EditorHost({ exportRef, value, label, schemas, objectSchemas, editors, onChange, onMove }: Props) {
	const s = schemaFor(schemas, exportRef.name, value);
	const kind = s.kind ?? "unknown";
	const itemSchema = s.item_schema;
	const titleField = s.title_field ?? label;

	const Custom = editors[kind];
	if (Custom) return <Custom exportRef={exportRef} value={value} context={{ schema: s, titleField, itemSchema, objectSchemas }} onChange={onChange} />;

	const text = (v: JSValue) => (v instanceof JSTemplate || v instanceof JSRaw ? v.text : typeof v === "string" ? v : String(v ?? ""));
	const textEditor = (
		<DocumentEditor
			value={text(value)}
			onChange={(t) => onChange(value instanceof JSTemplate ? new JSTemplate(t) : value instanceof JSRaw ? new JSRaw(t) : t)}
		/>
	);

	if (kind === "document") return textEditor;
	if (kind === "asset_collection") return <MediaListEditor value={value} onChange={onChange} />;
	if (kind === "collection")
		return (
			<TableEditor
				value={Array.isArray(value) ? value : []}
				onChange={onChange}
				objectSchema={itemSchema ? objectSchemas[itemSchema] : undefined}
				titleField={titleField}
				reverse={s.reverse === true}
				onMove={itemSchema ? (row) => onMove([], row, itemSchema) : undefined}
				dragMove={itemSchema ? { path: [], schema: itemSchema } : undefined}
			/>
		);
	if (kind === "graph" || Array.isArray(value) || isObject(value)) {
		const graphMove: MoveRequest = (path, row, schema) => onMove(path, row, schema ?? itemSchema);
		return (
			<GraphEditor
				value={Array.isArray(value) || isObject(value) ? value : {}}
				onChange={onChange}
				title={titleField}
				objectSchemas={objectSchemas}
				itemSchema={itemSchema}
				fieldSchemas={s.field_schemas}
				onMove={kind === "graph" ? graphMove : undefined}
			/>
		);
	}
	return textEditor;
}
