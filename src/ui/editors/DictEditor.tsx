import { useEffect, useRef, useState } from "react";

import { type ObjectSchema, fieldKinds, looksMultiline } from "../../core/schema";
import { type JSObject, type JSValue, JSRaw, JSTemplate, displayValue, prettyLabel, renameKey } from "../../core/values";
import { Button, Empty, Spacer, Toolbar } from "../common";
import { useDialogs } from "../dialogs";
import { ImagePicker } from "./Media";

function coerceLike(text: string, original: JSValue): JSValue {
	if (original === undefined || text === displayValue(original)) return original;
	if (original instanceof JSRaw) return new JSRaw(text);
	if (original instanceof JSTemplate) return new JSTemplate(text);
	if (typeof original === "boolean" && /^(true|false)$/i.test(text.trim())) return text.trim().toLowerCase() === "true";
	if (typeof original === "number" && text.trim() !== "" && Number.isFinite(Number(text))) return Number(text);
	if (original === null && !text.trim()) return null;
	return text;
}

export function DictEditor({ value, onChange, objectSchema }: { value: JSObject; onChange: (v: JSObject) => void; objectSchema?: ObjectSchema }) {
	const kinds = fieldKinds(objectSchema);
	const dialogs = useDialogs();
	const [keys, setKeys] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const last = useRef(value);
	const multiline = useRef(new Map<string, boolean>());

	useEffect(() => {
		if (last.current !== value) {
			last.current = value;
			setKeys({});
			setError(null);
		}
	}, [value]);

	const emit = (next: JSObject) => {
		last.current = next;
		onChange(next);
	};

	const commitKey = (orig: string) => {
		const draft = keys[orig];
		if (draft === undefined) return;
		const k = draft.trim();
		const clear = () =>
			setKeys((d) => {
				const { [orig]: _drop, ...rest } = d;
				return rest;
			});
		if (k === orig) return clear();
		if (!k) {
			setError("Field name can't be empty");
			return;
		}
		if (Object.hasOwn(value, k)) {
			setError(`Field "${k}" already exists`);
			return;
		}
		setError(null);
		clear();
		emit(renameKey(value, orig, k));
	};

	const add = async () => {
		const k = await dialogs.prompt({
			title: "Add field",
			label: "Field name",
			validate: (v) => (!v.trim() ? "Enter a field name" : Object.hasOwn(value, v.trim()) ? "Field already exists" : null),
		});
		if (k === null) return;
		emit({ ...value, [k.trim()]: "" });
	};

	const remove = async (k: string) => {
		if (!(await dialogs.confirm({ title: "Delete field", message: `Delete "${k}"?`, confirmLabel: "Delete", danger: true }))) return;
		const { [k]: _drop, ...rest } = value;
		emit(rest);
	};

	const entries = Object.entries(value);

	return (
		<div className="dict-editor">
			<Toolbar>
				<span className="pane-title">Fields</span>
				<Spacer />
				<Button icon="plus" onClick={add}>
					Add field
				</Button>
			</Toolbar>
			{error && <div className="form-error">{error}</div>}
			{entries.length === 0 ? (
				<Empty>No fields.</Empty>
			) : (
				<div className="dict-rows">
					{entries.map(([k, v]) => {
						const text = displayValue(v);
						if (!multiline.current.has(k)) multiline.current.set(k, looksMultiline(k, text));
						const multi = multiline.current.get(k);
						const setText = (t: string) => emit({ ...value, [k]: coerceLike(t, v) });
						return (
							<div className="dict-row" key={k}>
								<input
									className="dict-key"
									value={keys[k] ?? k}
									aria-label="Field name"
									title={prettyLabel(k)}
									onChange={(e) => setKeys((d) => ({ ...d, [k]: e.target.value }))}
									onBlur={() => commitKey(k)}
									onKeyDown={(e) => e.key === "Enter" && commitKey(k)}
									spellCheck={false}
								/>
								{kinds[k] === "image" && typeof v === "string" ? (
									<ImagePicker value={text} onChange={setText} />
								) : multi ? (
									<textarea className="dict-value" value={text} rows={4} onChange={(e) => setText(e.target.value)} />
								) : (
									<input className="dict-value" value={text} onChange={(e) => setText(e.target.value)} />
								)}
								<Button icon="trash" iconOnly variant="ghost" title="Delete field" onClick={() => remove(k)} />
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
