import { parse, type Node } from "acorn";

import { JSRaw, JSTemplate, type JSObject, type JSValue, isObject } from "./values";

export interface ExportSpan {
	name: string;
	start: number;
	end: number;
}

const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = Node & Record<string, any>;

export function parseExports(text: string): { exports: Record<string, JSValue>; spans: ExportSpan[] } {
	const program = parse(text, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true }) as AnyNode;
	const exports: Record<string, JSValue> = {};
	const spans: ExportSpan[] = [];

	for (const stmt of program.body as AnyNode[]) {
		if (stmt.type !== "ExportNamedDeclaration" || stmt.declaration?.type !== "VariableDeclaration") continue;
		for (const decl of stmt.declaration.declarations as AnyNode[]) {
			if (decl.id?.type !== "Identifier" || !decl.init) continue;
			const name = decl.id.name as string;
			exports[name] = nodeToValue(text, decl.init);
			spans.push({ name, start: decl.init.start, end: decl.init.end });
		}
	}

	return { exports, spans };
}

function nodeToValue(src: string, n: AnyNode): JSValue {
	const raw = () => new JSRaw(src.slice(n.start, n.end));

	switch (n.type) {
		case "TemplateLiteral": {
			const s = src.slice(n.start, n.end);
			return new JSTemplate(s.slice(1, -1).replace(/\\`/g, "`"));
		}
		case "Literal": {
			if (n.regex || n.bigint !== undefined) return raw();
			if (typeof n.value === "number" && !Number.isFinite(n.value)) return raw();
			return n.value as string | number | boolean | null;
		}
		case "UnaryExpression": {
			const arg = nodeToValue(src, n.argument);
			if (n.operator === "-" && typeof arg === "number") return -arg;
			if (n.operator === "+" && typeof arg === "number") return arg;
			if (n.operator === "!" && typeof arg === "boolean") return !arg;
			return raw();
		}
		case "ArrayExpression": {
			if ((n.elements as (AnyNode | null)[]).some((e) => !e || e.type === "SpreadElement")) return raw();
			return (n.elements as AnyNode[]).map((e) => nodeToValue(src, e));
		}
		case "ObjectExpression": {
			const out: JSObject = {};
			for (const p of n.properties as AnyNode[]) {
				if (p.type !== "Property" || p.kind !== "init" || p.computed || p.method || p.shorthand) return raw();
				let key: string;
				if (p.key.type === "Identifier") key = p.key.name;
				else if (p.key.type === "Literal" && typeof p.key.value === "string") key = p.key.value;
				else return raw();
				out[key] = nodeToValue(src, p.value);
			}
			return out;
		}
		default:
			return raw();
	}
}

const jsString = (s: string) => JSON.stringify(s);

function toJS(v: JSValue, indent: number): string {
	const pad = "\t".repeat(indent);
	const inner = "\t".repeat(indent + 1);

	if (v === null || v === undefined) return "null";
	if (v === true) return "true";
	if (v === false) return "false";
	if (v instanceof JSTemplate) return "`" + v.text.replace(/`/g, "\\`") + "`";
	if (v instanceof JSRaw) return v.text;
	if (typeof v === "number") {
		if (Number.isNaN(v)) return "NaN";
		if (!Number.isFinite(v)) return v > 0 ? "Infinity" : "-Infinity";
		return String(v);
	}
	if (typeof v === "string") return jsString(v);
	if (Array.isArray(v)) {
		if (!v.length) return "[]";
		return "[\n" + v.map((x) => `${inner}${toJS(x, indent + 1)},\n`).join("") + pad + "]";
	}
	if (isObject(v)) {
		const entries = Object.entries(v);
		if (!entries.length) return "{}";
		const rows = entries.map(([k, val]) => `${inner}${JS_IDENT.test(k) ? k : jsString(k)}: ${toJS(val, indent + 1)}`);
		return "{\n" + rows.map((r) => `${r},\n`).join("") + pad + "}";
	}
	return jsString(String(v));
}

export function serializeValue(value: JSValue): string {
	return toJS(value, 0);
}

export function replaceExportValue(text: string, span: ExportSpan, value: JSValue): string {
	let out = serializeValue(value);
	if (text.includes("\r\n")) out = out.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
	return text.slice(0, span.start) + out + text.slice(span.end);
}
