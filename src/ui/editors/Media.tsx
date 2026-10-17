import { useEffect, useState } from "react";

import { backend } from "../../core/backend";
import { type ResolvedMedia, resolveMedia, toJsPath } from "../../core/media";
import { Button } from "../common";
import { useDialogs } from "../dialogs";
import { Icon } from "../icons";

export function useResolvedMedia(jsPath: string | null | undefined) {
	const [state, setState] = useState<{ path: string; media: ResolvedMedia } | null>(null);

	useEffect(() => {
		if (!jsPath) return;
		let alive = true;
		void resolveMedia(jsPath).then((media) => alive && setState({ path: jsPath, media }));
		return () => {
			alive = false;
		};
	}, [jsPath]);

	return jsPath && state?.path === jsPath ? state.media : null;
}

export function MediaPreview({ jsPath, compact, emptyText = "No media" }: { jsPath: string | null | undefined; compact?: boolean; emptyText?: string }) {
	const media = useResolvedMedia(jsPath);
	const [failed, setFailed] = useState<string | null>(null);

	useEffect(() => setFailed(null), [jsPath]);

	let body;
	if (!jsPath) body = <div className="preview-note">{emptyText}</div>;
	else if (!media) body = <div className="preview-note">Loading…</div>;
	else if (media.error || !media.src) body = <div className="preview-note">{media.error ?? "Preview not available"}</div>;
	else if (failed === jsPath) body = <div className="preview-note">Could not load media</div>;
	else if (media.kind === "video")
		body = <video key={media.src} src={media.src} controls={!compact} muted={compact} loop autoPlay={!compact} playsInline onError={() => setFailed(jsPath)} />;
	else if (media.kind === "image") body = <img key={media.src} src={media.src} alt="" draggable={false} onError={() => setFailed(jsPath)} />;
	else body = <div className="preview-note">Preview not available</div>;

	return <div className={`preview ${compact ? "preview-compact" : ""}`}>{body}</div>;
}

export function Thumb({ jsPath }: { jsPath: string }) {
	const media = useResolvedMedia(jsPath);
	return (
		<div className="thumb">
			{media?.src && media.kind === "image" ? (
				<img src={media.src} alt="" loading="lazy" draggable={false} />
			) : (
				<Icon name={media?.kind === "video" ? "video" : "image"} size={16} />
			)}
		</div>
	);
}

export function usePickMedia() {
	const dialogs = useDialogs();
	return async (multiple: boolean): Promise<string[]> => {
		const res = await backend.pickMedia(multiple).catch((e) => {
			void dialogs.alert("Could not open file picker", String(e));
			return null;
		});
		if (!res) return [];
		if (res.rejected.length)
			void dialogs.alert(
				"Some files were skipped",
				<>
					<p>Only files inside the media folder can be used:</p>
					<ul className="path-list">
						{res.rejected.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>
				</>,
			);
		return res.rel.map(toJsPath);
	};
}

export function ImagePicker({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
	const pick = usePickMedia();
	return (
		<div className="image-picker">
			<div className="image-picker-row">
				<input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoFocus={autoFocus} placeholder="Path or URL" />
				<Button icon="folder" onClick={async () => {
					const [first] = await pick(false);
					if (first) onChange(first);
				}}>
					Browse
				</Button>
			</div>
			<MediaPreview jsPath={value.trim()} compact emptyText="No image" />
		</div>
	);
}
