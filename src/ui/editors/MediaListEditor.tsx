import { useEffect, useState } from "react";

import { fileName, resolveMedia } from "../../core/media";
import { type JSValue, moveInArray } from "../../core/values";
import { Button, Empty, Spacer, Toolbar } from "../common";
import { Icon } from "../icons";
import { useDialogs } from "../dialogs";
import { useReorder } from "../dnd";
import { MediaPreview, Thumb, usePickMedia } from "./Media";

export function MediaListEditor({ value, onChange }: { value: JSValue; onChange: (v: JSValue) => void }) {
	const items = Array.isArray(value) ? value.map((v) => (typeof v === "string" ? v : String(v))) : [];
	const [sel, setSel] = useState(items.length ? 0 : -1);
	const [localPath, setLocalPath] = useState<string | null>(null);
	const dialogs = useDialogs();
	const pick = usePickMedia();

	const current = sel >= 0 && sel < items.length ? items[sel] : null;

	useEffect(() => {
		if (sel >= items.length) setSel(items.length - 1);
	}, [items.length, sel]);

	useEffect(() => {
		setLocalPath(null);
		if (!current) return;
		let alive = true;
		void resolveMedia(current).then((m) => alive && setLocalPath(m.local));
		return () => {
			alive = false;
		};
	}, [current]);

	const add = async () => {
		const picked = await pick(true);
		if (!picked.length) return;
		onChange([...picked, ...items]);
		setSel(0);
	};

	const remove = async () => {
		if (!current) return;
		if (!(await dialogs.confirm({ title: "Delete media", message: `Remove "${fileName(current)}" from this list?`, confirmLabel: "Delete", danger: true })))
			return;
		onChange(items.filter((_, i) => i !== sel));
	};

	const move = (from: number, to: number) => {
		if (from === to || to < 0 || to >= items.length) return;
		onChange(moveInArray(items, from, to));
		setSel(to);
	};

	const reorder = useReorder(move);

	return (
		<div className="split split-media">
			<section className="pane">
				<Toolbar>
					<Button icon="plus" variant="primary" onClick={add}>
						Add
					</Button>
					<Button icon="trash" onClick={remove} disabled={!current}>
						Delete
					</Button>
					<Spacer />
					<Button icon="up" iconOnly title="Move up" onClick={() => move(sel, sel - 1)} disabled={sel <= 0} />
					<Button icon="down" iconOnly title="Move down" onClick={() => move(sel, sel + 1)} disabled={sel < 0 || sel >= items.length - 1} />
				</Toolbar>
				{items.length === 0 ? (
					<Empty icon="image">No media yet. Use Add to pick files.</Empty>
				) : (
					<ul
						className="list media-list"
						role="listbox"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown" || e.key === "ArrowUp") {
								e.preventDefault();
								const d = e.key === "ArrowDown" ? 1 : -1;
								if (e.altKey) move(sel, sel + d);
								else setSel((s) => Math.max(0, Math.min(items.length - 1, s + d)));
							} else if (e.key === "Delete") void remove();
						}}
					>
						{items.map((item, i) => (
							<li
								key={`${i}:${item}`}
								role="option"
								aria-selected={i === sel}
								className={`list-item ${i === sel ? "selected" : ""} ${reorder.dropClass(i)}`}
								onClick={() => setSel(i)}
								{...reorder.itemProps(i)}
							>
								<span className="grip">
									<Icon name="grip" size={14} />
								</span>
								<Thumb jsPath={item} />
								<span className="list-text">
									<span className="list-title">{fileName(item)}</span>
									<span className="list-sub">{item}</span>
								</span>
								<span className="list-index">{i + 1}</span>
							</li>
						))}
					</ul>
				)}
			</section>
			<section className="pane pane-preview">
				<div className="pane-title">Preview</div>
				<MediaPreview jsPath={current} emptyText="Select an item to preview" />
				{current && <div className="path-note" title={localPath ?? current}>{localPath ?? current}</div>}
			</section>
		</div>
	);
}
