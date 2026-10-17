export class JSTemplate {
	constructor(readonly text: string) {}
}

export class JSRaw {
	constructor(readonly text: string) {}

	toString() {
		return this.text;
	}
}

export type JSObject = { [key: string]: JSValue };
export type JSValue = string | number | boolean | null | JSTemplate | JSRaw | JSValue[] | JSObject;
export type PathKey = string | number;
export type Path = readonly PathKey[];

export const isObject = (v: unknown): v is JSObject =>
	typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof JSTemplate) && !(v instanceof JSRaw);

export const isTextLike = (v: unknown): v is string | JSTemplate | JSRaw =>
	typeof v === "string" || v instanceof JSTemplate || v instanceof JSRaw;

export const isScalar = (v: unknown) =>
	v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof JSTemplate || v instanceof JSRaw;

export function displayValue(v: JSValue | undefined): string {
	if (v === null || v === undefined) return "";
	if (v instanceof JSTemplate || v instanceof JSRaw) return v.text;
	if (typeof v === "object") return summarize(v);
	return String(v);
}

export function summarize(v: JSValue | undefined): string {
	if (v instanceof JSTemplate || v instanceof JSRaw) v = v.text;
	if (Array.isArray(v)) return v.length === 0 ? "Empty list" : `${v.length} item${v.length === 1 ? "" : "s"}`;
	if (isObject(v)) {
		const n = Object.keys(v).length;
		return `${n} field${n === 1 ? "" : "s"}`;
	}
	if (v === null || v === undefined) return "Blank";
	if (typeof v === "string") {
		const s = v.replace(/\s+/g, " ").trim();
		return s.length > 60 ? s.slice(0, 60) + "…" : s;
	}
	return String(v);
}

export function prettyLabel(k: PathKey): string {
	if (typeof k !== "string") return String(k);
	const s = k
		.trim()
		.replace(/_/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();

	return s
		.split(" ")
		.map((w) => (w === w.toUpperCase() || w.includes(".") ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
		.join(" ");
}

export function nodeLabel(path: Path, rootTitle: string): string {
	if (!path.length) return rootTitle || "Document";
	const last = path[path.length - 1];
	return typeof last === "number" ? `Item ${last + 1}` : prettyLabel(last);
}

export function coerceValue(text: string, old: JSValue | undefined, kind = "string"): JSValue {
	if (old !== undefined && text === displayValue(old) && (old === null || typeof old !== "object" || old instanceof JSTemplate || old instanceof JSRaw))
		return old;
	if (old instanceof JSTemplate) return new JSTemplate(text);
	if (old instanceof JSRaw) return new JSRaw(text);

	const numeric = ["number", "integer", "float"].includes(kind) || typeof old === "number";
	if (numeric) {
		const value = text.trim();
		if (!value) throw new Error("Enter a number");
		const n = Number(value);
		if (!Number.isFinite(n)) throw new Error(`Invalid number: ${text}`);
		return n;
	}

	if (kind === "boolean" || kind === "bool" || typeof old === "boolean") {
		const value = text.trim().toLowerCase();
		if (value !== "true" && value !== "false") throw new Error("Enter true or false");
		return value === "true";
	}

	if (kind === "template") return new JSTemplate(text);
	return text;
}

export function coerceScalar(t: string): JSValue {
	const s = t.trim();
	if (s === "") return "";
	if (s.toLowerCase() === "null" || s.toLowerCase() === "none") return null;
	if (s.toLowerCase() === "true" || s.toLowerCase() === "false") return s.toLowerCase() === "true";
	if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
	return s;
}

export function getIn(root: JSValue, path: Path): JSValue {
	let cur: JSValue = root;
	for (const key of path) {
		if (Array.isArray(cur) && typeof key === "number" && key >= 0 && key < cur.length) cur = cur[key];
		else if (isObject(cur) && typeof key === "string" && Object.hasOwn(cur, key)) cur = cur[key];
		else throw new Error(`Path ${path.join("/")} not found`);
	}
	return cur;
}

export function hasPath(root: JSValue, path: Path) {
	try {
		getIn(root, path);
		return true;
	} catch {
		return false;
	}
}

export function setIn(root: JSValue, path: Path, value: JSValue): JSValue {
	if (!path.length) return value;
	const [key, ...rest] = path;
	if (Array.isArray(root) && typeof key === "number") {
		const copy = root.slice();
		copy[key] = setIn(root[key], rest, value);
		return copy;
	}
	if (isObject(root) && typeof key === "string") return { ...root, [key]: setIn(root[key], rest, value) };
	throw new Error(`Path ${path.join("/")} not found`);
}

export function updateIn(root: JSValue, path: Path, fn: (v: JSValue) => JSValue): JSValue {
	return setIn(root, path, fn(getIn(root, path)));
}

export function deleteIn(root: JSValue, path: Path): JSValue {
	const parentPath = path.slice(0, -1);
	const last = path[path.length - 1];
	return updateIn(root, parentPath, (parent) => {
		if (Array.isArray(parent) && typeof last === "number") return parent.filter((_, i) => i !== last);
		if (isObject(parent) && typeof last === "string") {
			const { [last]: _removed, ...rest } = parent;
			return rest;
		}
		return parent;
	});
}

export function moveInArray<T>(arr: readonly T[], from: number, to: number): T[] {
	const copy = arr.slice();
	const [item] = copy.splice(from, 1);
	copy.splice(to, 0, item);
	return copy;
}

export function renameKey(obj: JSObject, from: string, to: string): JSObject {
	const out: JSObject = {};
	for (const [k, v] of Object.entries(obj)) out[k === from ? to : k] = v;
	return out;
}

const TITLE_KEYS = ["title", "name", "label", "courseName", "organisation", "heading"];

export function itemTitle(v: JSValue): string | null {
	if (!isObject(v)) return null;
	for (const k of TITLE_KEYS) {
		const t = v[k];
		if (isTextLike(t) && displayValue(t).trim()) return summarize(displayValue(t));
	}
	return null;
}
