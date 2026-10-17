import type { JSValue } from "./values";

export type FieldType = string | { type?: string; multiline?: boolean };

export interface EntrySchema {
	kind?: string;
	title_field?: string;
	item_schema?: string;
	field_schemas?: Record<string, string>;
	reverse?: boolean;
	[key: string]: unknown;
}

export type ObjectSchema = Record<string, FieldType>;

export interface FieldSpec {
	name: string;
	kind: string;
	multiline: boolean;
}

const MULTILINE_KEYS = new Set(["coursedescription", "description", "details", "content", "body", "notes"]);

export function looksMultiline(key: string, value?: unknown) {
	if (MULTILINE_KEYS.has(key.toLowerCase())) return true;
	const s = value === null || value === undefined ? "" : String(value);
	return s.length > 120 || s.includes("\n");
}

export function schemaFor(schemas: Record<string, EntrySchema>, exportName: string, value: JSValue): EntrySchema {
	const s = schemas[exportName];
	if (s) return { ...s };
	return { kind: "unknown", type: typeof value === "string" ? "string" : Array.isArray(value) ? "list" : value && typeof value === "object" ? "dict" : "unknown" };
}

export function fieldSpecs(objectSchema: ObjectSchema | undefined, columns: string[]): FieldSpec[] {
	const specs: FieldSpec[] = [];
	for (const [name, v] of Object.entries(objectSchema ?? {})) {
		if (name === "kind" || name === "item_schema") continue;
		if (typeof v === "object" && v) specs.push({ name, kind: v.type ?? "string", multiline: !!v.multiline });
		else specs.push({ name, kind: typeof v === "string" ? v : "string", multiline: looksMultiline(name) });
	}
	const known = new Set(specs.map((s) => s.name));
	for (const c of columns) if (!known.has(c)) specs.push({ name: c, kind: "string", multiline: looksMultiline(c) });
	return specs;
}

export function fieldKinds(objectSchema: ObjectSchema | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(objectSchema ?? {})) out[k] = typeof v === "object" && v ? (v.type ?? "string") : String(v);
	return out;
}
