import { useEffect, useState } from "react";

import { type JSValue, moveInArray, summarize } from "../../core/values";
import { Button, Empty, Spacer, Toolbar } from "../common";
import { useDialogs } from "../dialogs";
import { useReorder } from "../dnd";
import { pickNewValue } from "./NewValueForm";

export function ListEditor({ value, onChange }: { value: JSValue[]; onChange: (v: JSValue[]) => void }) {
	const [sel, setSel] = useState(value.length ? 0 : -1);
	const dialogs = useDialogs();

	useEffect(() => {
		if (sel >= value.length) setSel(value.length - 1);
	}, [value.length, sel]);

	const current = sel >= 0 ? value[sel] : undefined;

	const add = async () => {
		const v = await pickNewValue(dialogs, { title: "Add item", allowBlank: true });
		if (v === undefined) return;
		onChange([v, ...value]);
		setSel(0);
	};

	const remove = async () => {
		if (sel < 0) return;
		if (!(await dialogs.confirm({ title: "Delete item", message: `Delete item ${sel + 1}?`, confirmLabel: "Delete", danger: true }))) return;
		onChange(value.filter((_, i) => i !== sel));
	};

	const move = (d: -1 | 1) => {
		const to = sel + d;
		if (sel < 0 || to < 0 || to >= value.length) return;
		onChange(moveInArray(value, sel, to));
		setSel(to);
	};

	const reorder = useReorder((from, to) => {
		onChange(moveInArray(value, from, to));
		setSel(to);
	});

	return (
		<div className="list-editor">
			<Toolbar>
				<Button icon="plus" variant="primary" onClick={add}>
					Add
				</Button>
				<Button icon="trash" onClick={remove} disabled={sel < 0}>
					Delete
				</Button>
				<Spacer />
				<Button icon="up" iconOnly title="Move up" onClick={() => move(-1)} disabled={sel <= 0} />
				<Button icon="down" iconOnly title="Move down" onClick={() => move(1)} disabled={sel < 0 || sel >= value.length - 1} />
			</Toolbar>
			{value.length === 0 ? (
				<Empty>This list is empty.</Empty>
			) : (
				<ul className="list">
					{value.map((v, i) => (
						<li key={i} className={`list-item ${i === sel ? "selected" : ""} ${reorder.dropClass(i)}`} onClick={() => setSel(i)} {...reorder.itemProps(i)}>
							<span className="list-index">{i + 1}</span>
							<span className="list-text">
								<span className="list-title">{summarize(v) || <em className="muted">Empty text</em>}</span>
							</span>
						</li>
					))}
				</ul>
			)}
			{typeof current === "string" && (
				<label className="field">
					<span className="field-label">Item {sel + 1}</span>
					<input value={current} onChange={(e) => onChange(value.map((x, i) => (i === sel ? e.target.value : x)))} />
				</label>
			)}
			{current !== undefined && typeof current !== "string" && <div className="hint">Select this item in the outline to edit it.</div>}
		</div>
	);
}
