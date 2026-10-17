export function DocumentEditor({ value, onChange, label = "Text" }: { value: string; onChange: (v: string) => void; label?: string }) {
	const lines = value ? value.split("\n").length : 0;
	return (
		<div className="document-editor">
			<div className="document-meta">
				<span className="pane-title">{label}</span>
				<span className="muted">
					{lines} line{lines === 1 ? "" : "s"} · {value.length} character{value.length === 1 ? "" : "s"}
				</span>
			</div>
			<textarea className="document-text" value={value} onChange={(e) => onChange(e.target.value)} spellCheck />
		</div>
	);
}
