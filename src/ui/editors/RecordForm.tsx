import { useState } from "react";

import { type FieldSpec, looksMultiline } from "../../core/schema";
import { type JSObject, type JSValue, JSTemplate, coerceValue, displayValue, isScalar, prettyLabel, summarize } from "../../core/values";
import { Button } from "../common";
import { ImagePicker } from "./Media";

export function RecordForm({ fields, initial, close }: { fields: FieldSpec[]; initial: JSObject; close: (v: JSObject | null) => void }) {
	const [texts, setTexts] = useState<Record<string, string>>(() =>
		Object.fromEntries(fields.map((f) => [f.name, displayValue(initial[f.name])])),
	);
	const [errors, setErrors] = useState<Record<string, string>>({});

	const submit = () => {
		const out: JSObject = {};
		const errs: Record<string, string> = {};
		for (const f of fields) {
			const old = initial[f.name];
			if (old !== undefined && !isScalar(old)) {
				out[f.name] = old;
				continue;
			}
			const text = f.kind === "image" ? texts[f.name].trim() : texts[f.name];
			try {
				out[f.name] = f.kind === "template" ? new JSTemplate(text) : coerceValue(text, old, f.kind);
			} catch (e) {
				errs[f.name] = e instanceof Error ? e.message : String(e);
			}
		}
		setErrors(errs);
		if (!Object.keys(errs).length) close(out);
	};

	return (
		<form
			onSubmit={(e) => (e.preventDefault(), submit())}
			onKeyDown={(e) => {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					submit();
				}
			}}
		>
			<div className="modal-body form-grid">
				{fields.map((f, i) => {
					const old: JSValue | undefined = initial[f.name];
					const text = texts[f.name];
					const set = (v: string) => setTexts((t) => ({ ...t, [f.name]: v }));
					let input;
					if (old !== undefined && !isScalar(old))
						input = <div className="readonly-value">{summarize(old)} — edit this in the outline</div>;
					else if (f.kind === "image") input = <ImagePicker value={text} onChange={set} autoFocus={i === 0} />;
					else if (f.multiline || looksMultiline(f.name, text))
						input = <textarea value={text} rows={5} onChange={(e) => set(e.target.value)} autoFocus={i === 0} />;
					else input = <input value={text} onChange={(e) => set(e.target.value)} autoFocus={i === 0} inputMode={f.kind === "number" ? "decimal" : undefined} />;

					return (
						<label className="field" key={f.name}>
							<span className="field-label">{prettyLabel(f.name)}</span>
							{input}
							{errors[f.name] && <span className="form-error">{errors[f.name]}</span>}
						</label>
					);
				})}
			</div>
			<div className="modal-footer">
				<span className="hint">Ctrl+Enter to save</span>
				<Button onClick={() => close(null)}>Cancel</Button>
				<Button type="submit" variant="primary" icon="check">
					Save
				</Button>
			</div>
		</form>
	);
}
