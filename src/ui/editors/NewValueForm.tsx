import { useState } from "react";

import type { JSValue } from "../../core/values";
import { Button } from "../common";
import type { Dialogs } from "../dialogs";

type Kind = "text" | "number" | "list" | "section" | "blank";

const KINDS: { kind: Kind; label: string }[] = [
	{ kind: "text", label: "Text" },
	{ kind: "number", label: "Number" },
	{ kind: "list", label: "List" },
	{ kind: "section", label: "Section (fields)" },
	{ kind: "blank", label: "Blank" },
];

interface Result {
	key: string;
	value: JSValue;
}

function NewValueForm({ withKey, allowBlank, existing, close }: {
	withKey: boolean;
	allowBlank: boolean;
	existing: string[];
	close: (r: Result | null) => void;
}) {
	const [kind, setKind] = useState<Kind>("text");
	const [key, setKey] = useState("");
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);

	const submit = () => {
		const k = key.trim();
		if (withKey && !k) return setError("Enter a field name");
		if (withKey && existing.includes(k)) return setError("Field already exists");
		let value: JSValue;
		if (kind === "number") {
			const n = Number(text.trim());
			if (!text.trim() || !Number.isFinite(n)) return setError("Enter a valid number");
			value = n;
		} else value = kind === "text" ? text : kind === "list" ? [] : kind === "section" ? {} : null;
		close({ key: k, value });
	};

	return (
		<form onSubmit={(e) => (e.preventDefault(), submit())}>
			<div className="modal-body form-grid">
				{withKey && (
					<label className="field">
						<span className="field-label">Field name</span>
						<input value={key} onChange={(e) => (setKey(e.target.value), setError(null))} autoFocus spellCheck={false} />
					</label>
				)}
				<div className="field">
					<span className="field-label">Type</span>
					<div className="segmented" role="radiogroup">
						{KINDS.filter((k) => allowBlank || k.kind !== "blank").map((k) => (
							<button
								type="button"
								role="radio"
								aria-checked={kind === k.kind}
								key={k.kind}
								className={kind === k.kind ? "active" : undefined}
								onClick={() => (setKind(k.kind), setError(null))}
							>
								{k.label}
							</button>
						))}
					</div>
				</div>
				{(kind === "text" || kind === "number") && (
					<label className="field">
						<span className="field-label">{kind === "text" ? "Text" : "Number"}</span>
						<input
							value={text}
							onChange={(e) => (setText(e.target.value), setError(null))}
							inputMode={kind === "number" ? "decimal" : undefined}
							autoFocus={!withKey}
						/>
					</label>
				)}
				{error && <div className="form-error">{error}</div>}
			</div>
			<div className="modal-footer">
				<Button onClick={() => close(null)}>Cancel</Button>
				<Button type="submit" variant="primary">
					Add
				</Button>
			</div>
		</form>
	);
}

export async function pickNewValue(dialogs: Dialogs, opts: { title: string; allowBlank?: boolean }): Promise<JSValue | undefined> {
	const r = await dialogs.open<Result>(opts.title, (close) => <NewValueForm withKey={false} allowBlank={!!opts.allowBlank} existing={[]} close={close} />);
	return r ? r.value : undefined;
}

export async function pickNewField(dialogs: Dialogs, existing: string[]): Promise<Result | null> {
	return dialogs.open<Result>("Add field", (close) => <NewValueForm withKey allowBlank={false} existing={existing} close={close} />);
}
