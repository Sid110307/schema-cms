import { backend } from "./backend";
import { type ExportSpan, parseExports, replaceExportValue } from "./jsExports";
import { type JSValue, type Path, JSRaw, JSTemplate, getIn, setIn } from "./values";

export interface ExportRef {
	file: string;
	name: string;
}

export const refKey = (r: ExportRef) => `${r.file}::${r.name}`;
export const sameRef = (a: ExportRef | null | undefined, b: ExportRef | null | undefined) =>
	!!a && !!b && a.file === b.file && a.name === b.name;
export const baseName = (p: string) => p.split(/[\\/]/).pop() || p;

interface Blob {
	text: string;
	exports: Record<string, JSValue>;
	spans: Record<string, ExportSpan>;
	order: string[];
	dirty: Set<string>;
}

export interface FileError {
	file: string;
	message: string;
}

type Listener = () => void;

export class DataStore {
	private files = new Map<string, Blob>();
	private listeners = new Set<Listener>();
	errors: FileError[] = [];
	version = 0;

	subscribe = (fn: Listener) => {
		this.listeners.add(fn);
		return () => void this.listeners.delete(fn);
	};

	getVersion = () => this.version;

	private emit() {
		this.version++;
		for (const fn of this.listeners) fn();
	}

	async load() {
		const paths = await backend.listFiles();
		const files = new Map<string, Blob>();
		const errors: FileError[] = [];

		await Promise.all(
			paths.map(async (file) => {
				try {
					files.set(file, this.parse(await backend.readFile(file)));
				} catch (e) {
					errors.push({ file, message: e instanceof Error ? e.message : String(e) });
				}
			}),
		);

		this.files = new Map(paths.filter((p) => files.has(p)).map((p) => [p, files.get(p)!]));
		this.errors = errors;
		this.emit();
	}

	private parse(text: string): Blob {
		const { exports, spans } = parseExports(text);
		return {
			text,
			exports,
			spans: Object.fromEntries(spans.map((s) => [s.name, s])),
			order: spans.map((s) => s.name),
			dirty: new Set(),
		};
	}

	listFiles() {
		return [...this.files.keys()];
	}

	exportsOf(file: string): { name: string; value: JSValue }[] {
		const blob = this.files.get(file);
		return blob ? blob.order.map((name) => ({ name, value: blob.exports[name] })) : [];
	}

	refs(): ExportRef[] {
		return this.listFiles().flatMap((file) => this.files.get(file)!.order.map((name) => ({ file, name })));
	}

	has(ref: ExportRef) {
		return !!this.files.get(ref.file) && Object.hasOwn(this.files.get(ref.file)!.exports, ref.name);
	}

	get(ref: ExportRef): JSValue {
		const blob = this.files.get(ref.file);
		if (!blob || !Object.hasOwn(blob.exports, ref.name)) throw new Error(`Export "${ref.name}" not found in ${baseName(ref.file)}`);
		return blob.exports[ref.name];
	}

	set(ref: ExportRef, value: JSValue) {
		const blob = this.files.get(ref.file);
		if (!blob) throw new Error(`File not loaded: ${ref.file}`);

		const old = blob.exports[ref.name];
		if (typeof value === "string") {
			if (old instanceof JSTemplate) value = new JSTemplate(value);
			else if (old instanceof JSRaw) value = new JSRaw(value);
		}
		if (old === value) return;

		blob.exports[ref.name] = value;
		blob.dirty.add(ref.name);
		this.emit();
	}

	isDirty(ref: ExportRef) {
		return !!this.files.get(ref.file)?.dirty.has(ref.name);
	}

	dirtyCount() {
		let n = 0;
		for (const blob of this.files.values()) n += blob.dirty.size;
		return n;
	}

	hasUnsaved() {
		return this.dirtyCount() > 0;
	}

	moveItem(source: ExportRef, sourcePath: Path, row: number, dest: ExportRef, destPath: Path) {
		if (sameRef(source, dest) && sourcePath.join("\u0000") === destPath.join("\u0000")) throw new Error("Choose a different destination list");

		const srcList = getIn(this.get(source), sourcePath);
		if (!Array.isArray(srcList)) throw new Error("Both locations must be lists");
		if (row < 0 || row >= srcList.length) throw new Error("The selected item is no longer available");
		const item = srcList[row];

		const removed = setIn(this.get(source), sourcePath, srcList.filter((_, i) => i !== row));
		const destRoot = sameRef(source, dest) ? removed : this.get(dest);
		const destList = getIn(destRoot, destPath);
		if (!Array.isArray(destList)) throw new Error("Both locations must be lists");
		const inserted = setIn(destRoot, destPath, [item, ...destList]);

		const srcBlob = this.files.get(source.file)!;
		const destBlob = this.files.get(dest.file)!;
		if (sameRef(source, dest)) {
			srcBlob.exports[source.name] = inserted;
		} else {
			srcBlob.exports[source.name] = removed;
			destBlob.exports[dest.name] = inserted;
		}
		srcBlob.dirty.add(source.name);
		destBlob.dirty.add(dest.name);
		this.emit();
	}

	async saveAll(): Promise<string[]> {
		const pending: { path: string; text: string }[] = [];
		for (const [path, blob] of this.files) {
			if (!blob.dirty.size) continue;
			let text = blob.text;
			const names = [...blob.dirty].filter((n) => blob.spans[n]).sort((a, b) => blob.spans[b].start - blob.spans[a].start);
			for (const name of names) text = replaceExportValue(text, blob.spans[name], blob.exports[name]);
			this.parse(text);
			pending.push({ path, text });
		}
		if (!pending.length) return [];

		await backend.saveFiles(pending);
		for (const { path, text } of pending) this.files.set(path, this.parse(text));
		this.emit();
		return pending.map((p) => p.path);
	}
}
