import { useEffect, useMemo, useRef, useState } from "react";

import { type ObjectSchema, fieldSpecs } from "../../core/schema";
import { type JSObject, type JSValue, type Path, displayValue, isObject, moveInArray, prettyLabel } from "../../core/values";
import { Button, Empty, SearchInput, Spacer, Toolbar } from "../common";
import { useDialogs } from "../dialogs";
import { useMoveDrag, useReorder } from "../dnd";
import { RecordForm } from "./RecordForm";

interface Props {
	value: JSValue;
	onChange: (v: JSValue) => void;
	objectSchema?: ObjectSchema;
	titleField?: string;
	reverse?: boolean;
	onMove?: (row: number) => void;
	dragMove?: { path: Path; schema: string };
}

const cellText = (v: JSValue | undefined) => displayValue(v);

export function TableEditor({ value, onChange, objectSchema, titleField = "title", reverse, onMove, dragMove }: Props) {
	const moveDrag = useMoveDrag();
	const rows = useMemo(() => (Array.isArray(value) ? value.map((r) => (isObject(r) ? r : {})) : []), [value]);
	const [query, setQuery] = useState("");
	const [sel, setSel] = useState<number | null>(null);
	const dialogs = useDialogs();
	const tableRef = useRef<HTMLDivElement>(null);

	const columns = useMemo(() => {
		const cols: string[] = [];
		const seen = new Set<string>();
		const add = (k: string) => !seen.has(k) && (seen.add(k), cols.push(k));
		Object.keys(objectSchema ?? {}).filter((k) => k !== "kind" && k !== "item_schema").forEach(add);
		rows.forEach((r) => Object.keys(r).forEach(add));
		if (!cols.length) cols.push(titleField);
		return cols;
	}, [rows, objectSchema, titleField]);

	const q = query.trim().toLowerCase();
	const visible = useMemo(
		() =>
			rows
				.map((row, index) => ({ row, index }))
				.filter(({ row }) => !q || Object.values(row).map(cellText).join(" ").toLowerCase().includes(q)),
		[rows, q],
	);

	useEffect(() => {
		if (sel !== null && sel >= rows.length) setSel(rows.length ? rows.length - 1 : null);
	}, [rows.length, sel]);

	useEffect(() => {
		if (sel === null) return;
		tableRef.current?.querySelector(`[data-row="${sel}"]`)?.scrollIntoView({ block: "nearest" });
	}, [sel]);

	const specs = () => fieldSpecs(objectSchema, columns);

	const add = async () => {
		const row = await dialogs.open<JSObject>("Add entry", (close) => <RecordForm fields={specs()} initial={{}} close={close} />, { wide: true });
		if (!row) return;
		onChange([row, ...rows]);
		setQuery("");
		setSel(0);
	};

	const edit = async (index = sel) => {
		if (index === null) return;
		const row = await dialogs.open<JSObject>("Edit entry", (close) => <RecordForm fields={specs()} initial={rows[index]} close={close} />, { wide: true });
		if (!row) return;
		onChange(rows.map((r, i) => (i === index ? { ...r, ...row } : r)));
	};

	const remove = async () => {
		if (sel === null) return;
		const title = displayValue(rows[sel][titleField] ?? rows[sel].title ?? rows[sel].name);
		const ok = await dialogs.confirm({
			title: "Delete entry",
			message: title ? `Delete "${title.length > 80 ? title.slice(0, 80) + "…" : title}"?` : "Delete the selected entry?",
			confirmLabel: "Delete",
			danger: true,
		});
		if (!ok) return;
		onChange(rows.filter((_, i) => i !== sel));
	};

	const visiblePos = sel === null ? -1 : visible.findIndex((v) => v.index === sel);
	const canReorder = sel !== null && !q;

	const move = (dir: -1 | 1) => {
		if (!canReorder || sel === null) return;
		const to = sel + dir;
		if (to < 0 || to >= rows.length) return;
		onChange(moveInArray(rows, sel, to));
		setSel(to);
	};

	const onKey = (e: React.KeyboardEvent) => {
		if (!(e.target as HTMLElement).closest(".table-wrap")) return;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const d = e.key === "ArrowDown" ? 1 : -1;
			if (e.altKey) return move(d);
			const next = Math.max(0, Math.min(visible.length - 1, visiblePos + d));
			if (visible[next]) setSel(visible[next].index);
		} else if (e.key === "Enter") {
			e.preventDefault();
			void edit();
		} else if (e.key === "Delete") void remove();
	};

	const reorder = useReorder(
		(from, to) => {
			onChange(moveInArray(rows, visible[from].index, visible[to].index));
			setSel(visible[to].index);
		},
		{
			enabled: !q,
			onStart: (pos) => dragMove && moveDrag?.start(dragMove.path, visible[pos].index, dragMove.schema),
			onEnd: () => moveDrag?.end(),
		},
	);

	const rowNumber = (index: number) => (reverse ? rows.length - index : index + 1);

	return (
		<div className="table-editor" onKeyDown={onKey}>
			<Toolbar>
				<SearchInput value={query} onChange={setQuery} placeholder={`Search ${rows.length} entries…`} />
				<Button icon="plus" variant="primary" onClick={add}>
					Add
				</Button>
				<Button icon="edit" onClick={() => edit()} disabled={sel === null}>
					Edit
				</Button>
				<Button icon="trash" onClick={remove} disabled={sel === null}>
					Delete
				</Button>
				{onMove && (
					<Button icon="move" onClick={() => sel !== null && onMove(sel)} disabled={sel === null} title="Move to another page or group">
						Move to…
					</Button>
				)}
				<Spacer />
				<Button icon="up" iconOnly title={q ? "Clear search to reorder" : "Move up (Alt+↑)"} onClick={() => move(-1)} disabled={!canReorder || sel === 0} />
				<Button
					icon="down"
					iconOnly
					title={q ? "Clear search to reorder" : "Move down (Alt+↓)"}
					onClick={() => move(1)}
					disabled={!canReorder || sel === rows.length - 1}
				/>
			</Toolbar>

			{rows.length === 0 ? (
				<Empty icon="file">No entries yet. Use Add to create one.</Empty>
			) : visible.length === 0 ? (
				<Empty icon="search">No entries match “{query}”.</Empty>
			) : (
				<div className="table-wrap" ref={tableRef} tabIndex={0}>
					<table className="table">
						<thead>
							<tr>
								<th className="col-num">#</th>
								{columns.map((c) => (
									<th key={c} className={c === "title" || c === "name" ? "col-wide" : undefined}>
										{prettyLabel(c)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{visible.map(({ row, index }, pos) => (
								<tr
									key={index}
									data-row={index}
									{...reorder.itemProps(pos)}
									className={`${index === sel ? "selected" : ""} ${reorder.dropClass(pos)}`}
									onClick={() => setSel(index)}
									onDoubleClick={() => edit(index)}
								>
									<td className="col-num">{rowNumber(index)}</td>
									{columns.map((c) => {
										const text = cellText(row[c]);
										return (
											<td key={c} title={text.length > 40 ? text : undefined}>
												<div className="cell">{text}</div>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
