import { useEffect, useMemo, useState } from "react";

import { isMediaPath } from "../../core/media";
import { type ObjectSchema, fieldSpecs } from "../../core/schema";
import {
	type JSObject,
	type JSValue,
	type Path,
	JSRaw,
	JSTemplate,
	coerceScalar,
	deleteIn,
	displayValue,
	getIn,
	hasPath,
	isObject,
	isScalar,
	itemTitle,
	moveInArray,
	nodeLabel,
	setIn,
	summarize,
	updateIn,
} from "../../core/values";
import type { MoveRequest } from "../../types";
import { Button, Spacer, Toolbar } from "../common";
import { useDialogs } from "../dialogs";
import { useMoveDrag } from "../dnd";
import { Icon } from "../icons";
import { DictEditor } from "./DictEditor";
import { DocumentEditor } from "./DocumentEditor";
import { ListEditor } from "./ListEditor";
import { ImagePicker } from "./Media";
import { pickNewField, pickNewValue } from "./NewValueForm";
import { RecordForm } from "./RecordForm";
import { TableEditor } from "./TableEditor";

interface Props {
	value: JSValue;
	onChange: (v: JSValue) => void;
	title: string;
	objectSchemas: Record<string, ObjectSchema>;
	itemSchema?: string;
	fieldSchemas?: Record<string, string>;
	onMove?: MoveRequest;
}

const pk = (p: Path) => JSON.stringify(p);

function nearestExisting(root: JSValue, path: Path): Path {
	let p = path;
	while (p.length && !hasPath(root, p)) p = p.slice(0, -1);
	return p;
}

function metaFor(v: JSValue) {
	if (isMediaPath(v)) return "Media";
	if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
	if (isObject(v)) {
		const n = Object.keys(v).length;
		return `${n} field${n === 1 ? "" : "s"}`;
	}
	if (typeof v === "string" || v instanceof JSRaw || v instanceof JSTemplate) return "Text";
	if (typeof v === "number") return "Number";
	return "Value";
}

export function GraphEditor({ value, onChange, title, objectSchemas, itemSchema, fieldSchemas = {}, onMove }: Props) {
	const dialogs = useDialogs();
	const [selected, setSelected] = useState<Path>([]);
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set([pk([])]));
	const [odrag, setODrag] = useState<{ from: Path; over: Path | null; after: boolean } | null>(null);
	const moveDrag = useMoveDrag();

	const path = useMemo(() => nearestExisting(value, selected), [value, selected]);
	const current = getIn(value, path);

	useEffect(() => {
		if (pk(path) !== pk(selected)) setSelected(path);
	}, [path, selected]);

	const select = (p: Path) => {
		setSelected(p);
		setExpanded((e) => {
			const next = new Set(e);
			for (let i = 0; i < p.length; i++) next.add(pk(p.slice(0, i)));
			return next;
		});
	};

	const toggle = (p: Path) =>
		setExpanded((e) => {
			const next = new Set(e);
			const k = pk(p);
			if (next.has(k)) next.delete(k);
			else next.add(k);
			return next;
		});

	const schemaForList = (listPath: Path) => {
		const key = listPath[listPath.length - 1];
		return (typeof key === "string" ? fieldSchemas[key] : undefined) || itemSchema;
	};

	const sameParent = (a: Path, b: Path) => a.length === b.length && pk(a.slice(0, -1)) === pk(b.slice(0, -1));

	const outlineDnd: OutlineDnd = {
		canDrag: (p) => typeof p[p.length - 1] === "number" && Array.isArray(getIn(value, p.slice(0, -1))),
		start: (p) => {
			setODrag({ from: p, over: null, after: false });
			const parentP = p.slice(0, -1);
			const schema = schemaForList(parentP);
			if (moveDrag && onMove && schema && isObject(getIn(value, p))) moveDrag.start(parentP, p[p.length - 1] as number, schema);
		},
		over: (p, after) => {
			if (!odrag || !sameParent(odrag.from, p)) return false;
			if (!odrag.over || pk(odrag.over) !== pk(p) || odrag.after !== after) setODrag({ ...odrag, over: p, after });
			return true;
		},
		drop: () => {
			if (odrag?.over) {
				const parentP = odrag.from.slice(0, -1);
				const from = odrag.from[odrag.from.length - 1] as number;
				let to = (odrag.over[odrag.over.length - 1] as number) + (odrag.after ? 1 : 0);
				if (from < to) to--;
				const list = getIn(value, parentP);
				if (to !== from && Array.isArray(list)) {
					onChange(setIn(value, parentP, moveInArray(list, from, to)));
					select([...parentP, to]);
				}
			}
			outlineDnd.end();
		},
		end: () => {
			setODrag(null);
			moveDrag?.end();
		},
		classFor: (p) => {
			if (!odrag) return "";
			if (pk(odrag.from) === pk(p)) return "dragging";
			if (odrag.over && pk(odrag.over) === pk(p)) return odrag.after ? "drop-after" : "drop-before";
			return "";
		},
	};

	const objectSchemaAt = (p: Path): ObjectSchema | undefined => {
		if (!p.length) return undefined;
		const key = p[p.length - 1];
		const name = typeof key === "number" ? schemaForList(p.slice(0, -1)) : fieldSchemas[key] ?? (objectSchemaAt(p.slice(0, -1))?.[key] as string | undefined);
		return typeof name === "string" ? objectSchemas[name] : undefined;
	};

	const fieldKindAt = (p: Path) => {
		const key = p[p.length - 1];
		const spec = typeof key === "string" ? objectSchemaAt(p.slice(0, -1))?.[key] : undefined;
		return typeof spec === "object" && spec ? spec.type : spec;
	};

	const setAt = (p: Path, v: JSValue) => onChange(setIn(value, p, v));

	const parentPath = path.slice(0, -1);
	const last = path[path.length - 1];
	const parent = path.length ? getIn(value, parentPath) : null;
	const inList = typeof last === "number" && Array.isArray(parent);
	const parentSchema = inList ? schemaForList(parentPath) : undefined;
	const canMovePage = !!onMove && inList && !!parentSchema && isObject(current);

	const move = (d: -1 | 1) => {
		if (!inList || !Array.isArray(parent)) return;
		const to = (last as number) + d;
		if (to < 0 || to >= parent.length) return;
		onChange(setIn(value, parentPath, moveInArray(parent, last as number, to)));
		select([...parentPath, to]);
	};

	const remove = async () => {
		if (!path.length) return;
		if (!(await dialogs.confirm({ title: "Delete item", message: `Delete "${nodeLabel(path, title)}"?`, confirmLabel: "Delete", danger: true }))) return;
		onChange(deleteIn(value, path));
		setSelected(parentPath);
	};

	const add = async () => {
		let target = path;
		let node = current;
		if (!Array.isArray(node) && !isObject(node)) {
			target = parentPath;
			node = getIn(value, target);
		}

		if (Array.isArray(node)) {
			const schemaName = schemaForList(target);
			const objectSchema = schemaName ? objectSchemas[schemaName] : undefined;
			let item: JSValue | undefined;
			if (objectSchema) {
				const row = await dialogs.open<JSObject>("Add entry", (close) => <RecordForm fields={fieldSpecs(objectSchema, [])} initial={{}} close={close} />, {
					wide: true,
				});
				item = row ?? undefined;
			} else item = await pickNewValue(dialogs, { title: "Add item" });
			if (item === undefined) return;
			onChange(updateIn(value, target, (l) => [item, ...(l as JSValue[])]));
			select([...target, 0]);
		} else if (isObject(node)) {
			const r = await pickNewField(dialogs, Object.keys(node));
			if (!r) return;
			onChange(updateIn(value, target, (o) => ({ ...(o as JSObject), [r.key]: r.value })));
			select([...target, r.key]);
		}
	};

	const detail = () => {
		const p = path;
		if (isMediaPath(current) || (typeof current === "string" && fieldKindAt(p) === "image")) return <ImagePicker value={current} onChange={(v) => setAt(p, v)} />;

		if (Array.isArray(current)) {
			const schemaName = schemaForList(p);
			if ((current.length && current.every(isObject)) || (!current.length && schemaName))
				return (
					<TableEditor
						key={pk(p)}
						value={current}
						onChange={(v) => setAt(p, v)}
						objectSchema={schemaName ? objectSchemas[schemaName] : undefined}
						onMove={onMove && schemaName ? (row) => onMove(p, row, schemaName) : undefined}
						dragMove={onMove && schemaName ? { path: p, schema: schemaName } : undefined}
					/>
				);
			return <ListEditor key={pk(p)} value={current} onChange={(v) => setAt(p, v)} />;
		}

		if (isObject(current)) {
			if (Object.values(current).every(isScalar))
				return <DictEditor key={pk(p)} value={current} onChange={(v) => setAt(p, v)} objectSchema={objectSchemaAt(p)} />;
			return (
				<div className="child-cards">
					{Object.entries(current).map(([k, v]) => (
						<button type="button" className="child-card" key={k} onClick={() => select([...p, k])}>
							<span className="list-title">{nodeLabel([k], "")}</span>
							<span className="list-sub">{summarize(v)}</span>
							<Icon name="chevron" size={14} />
						</button>
					))}
				</div>
			);
		}

		if (current instanceof JSRaw) return <DocumentEditor value={current.text} onChange={(t) => setAt(p, new JSRaw(t))} />;
		if (current instanceof JSTemplate) return <DocumentEditor value={current.text} onChange={(t) => setAt(p, new JSTemplate(t))} />;
		if (typeof current === "string") return <DocumentEditor value={current} onChange={(t) => setAt(p, t)} />;
		return <ScalarEditor key={pk(p)} value={current} onChange={(v) => setAt(p, v)} />;
	};

	return (
		<div className="split split-graph">
			<section className="pane pane-outline">
				<Toolbar>
					<Button icon="plus" variant="primary" onClick={add}>
						Add
					</Button>
					<Button icon="trash" onClick={remove} disabled={!path.length}>
						Delete
					</Button>
					{onMove && (
						<Button icon="move" onClick={() => onMove(parentPath, last as number, parentSchema)} disabled={!canMovePage} title="Move to another page or group">
							Move to…
						</Button>
					)}
					<Spacer />
					<Button icon="up" iconOnly title="Move up" onClick={() => move(-1)} disabled={!inList || last === 0} />
					<Button
						icon="down"
						iconOnly
						title="Move down"
						onClick={() => move(1)}
						disabled={!inList || !Array.isArray(parent) || (last as number) >= parent.length - 1}
					/>
				</Toolbar>
				<div className="outline" role="tree">
					<OutlineNode value={value} path={[]} title={title} selected={path} expanded={expanded} onSelect={select} onToggle={toggle} dnd={outlineDnd} />
				</div>
			</section>
			<section className="pane pane-detail">
				<div className="detail-head">
					<div className="detail-title">{path.length ? `${title ? title + " → " : ""}${nodeLabel(path, title)}` : title || "Document"}</div>
					<div className="muted">{metaFor(current)}</div>
				</div>
				<div className="detail-body">{detail()}</div>
			</section>
		</div>
	);
}

function ScalarEditor({ value, onChange }: { value: JSValue; onChange: (v: JSValue) => void }) {
	const [text, setText] = useState(displayValue(value));
	return (
		<label className="field">
			<span className="field-label">Value</span>
			<input
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					onChange(coerceScalar(e.target.value));
				}}
			/>
			<span className="hint">Numbers, true/false and null are detected automatically.</span>
		</label>
	);
}

interface OutlineDnd {
	canDrag(p: Path): boolean;
	start(p: Path): void;
	over(p: Path, after: boolean): boolean;
	drop(): void;
	end(): void;
	classFor(p: Path): string;
}

interface NodeProps {
	dnd: OutlineDnd;
	value: JSValue;
	path: Path;
	title: string;
	selected: Path;
	expanded: Set<string>;
	onSelect: (p: Path) => void;
	onToggle: (p: Path) => void;
}

function OutlineNode({ value, path, title, selected, expanded, onSelect, onToggle, dnd }: NodeProps) {
	const draggable = dnd.canDrag(path);
	const isContainer = Array.isArray(value) || isObject(value);
	const children: [string | number, JSValue][] = Array.isArray(value)
		? value.map((v, i) => [i, v])
		: isObject(value)
			? Object.entries(value)
			: [];
	const k = pk(path);
	const open = expanded.has(k);
	const isSel = k === pk(selected);

	return (
		<div role="treeitem" aria-expanded={isContainer ? open : undefined} aria-selected={isSel}>
			<div
				className={`outline-row ${isSel ? "selected" : ""} ${dnd.classFor(path)}`}
				draggable={draggable}
				onDragStart={(e) => {
					if (!draggable) return;
					e.stopPropagation();
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", nodeLabel(path, title));
					dnd.start(path);
				}}
				onDragOver={(e) => {
					const rect = e.currentTarget.getBoundingClientRect();
					if (dnd.over(path, e.clientY > rect.top + rect.height / 2)) {
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
					}
				}}
				onDrop={(e) => {
					e.preventDefault();
					dnd.drop();
				}}
				onDragEnd={() => dnd.end()}
				style={{ paddingLeft: 6 + path.length * 14 }}
				onClick={() => onSelect(path)}
				onDoubleClick={() => isContainer && onToggle(path)}
			>
				<button
					type="button"
					className={`twisty ${open ? "open" : ""} ${children.length ? "" : "hidden"}`}
					onClick={(e) => {
						e.stopPropagation();
						onToggle(path);
					}}
					tabIndex={-1}
					aria-label={open ? "Collapse" : "Expand"}
				>
					<Icon name="chevron" size={12} />
				</button>
				<span className="outline-label">{nodeLabel(path, title)}</span>
				<span className="outline-summary">{(typeof path[path.length - 1] === "number" && itemTitle(value)) || summarize(value)}</span>
			</div>
			{open &&
				children.map(([key, child]) => (
					<OutlineNode
						key={String(key)}
						value={child}
						path={[...path, key]}
						title={title}
						selected={selected}
						expanded={expanded}
						onSelect={onSelect}
						onToggle={onToggle}
						dnd={dnd}
					/>
				))}
		</div>
	);
}
