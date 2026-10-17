import { type EntrySchema, schemaFor } from "./schema";
import { type DataStore, type ExportRef, baseName, sameRef } from "./store";
import { type JSValue, type Path, isObject, prettyLabel } from "./values";

export interface MoveDestination {
	label: string;
	file: string;
	ref: ExportRef;
	path: Path;
}

export function moveDestinations(
	store: DataStore,
	schemas: Record<string, EntrySchema>,
	labelOf: (name: string) => string,
	source: ExportRef,
	sourcePath: Path,
	itemSchema: string | undefined,
): MoveDestination[] {
	const out: MoveDestination[] = [];

	for (const ref of store.refs()) {
		const value = store.get(ref);
		const schema = schemaFor(schemas, ref.name, value);
		const label = labelOf(ref.name);
		const file = baseName(ref.file);

		if (schema.kind === "collection" && schema.item_schema === itemSchema && Array.isArray(value) && value.every(isObject))
			out.push({ label, file, ref, path: [] });

		if (schema.kind === "graph" && (Array.isArray(value) || isObject(value))) {
			const fieldSchemas = schema.field_schemas ?? {};
			const visit = (node: JSValue, path: Path) => {
				if (Array.isArray(node)) {
					const key = path[path.length - 1];
					const nodeSchema = (typeof key === "string" ? fieldSchemas[key] : undefined) || schema.item_schema;
					if (nodeSchema === itemSchema && node.every(isObject)) {
						const group = path.map(prettyLabel).join(" → ");
						out.push({ label: group ? `${label} → ${group}` : label, file, ref, path });
					}
				} else if (isObject(node)) {
					for (const [k, child] of Object.entries(node)) visit(child, [...path, k]);
				}
			};
			visit(value, []);
		}
	}

	return out.filter((d) => !(sameRef(d.ref, source) && JSON.stringify(d.path) === JSON.stringify(sourcePath)));
}
