import { backend } from "./backend";

export const IMAGE_EXTS = [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".avif"];
export const VIDEO_EXTS = [".mp4", ".mov", ".m4v", ".webm"];

let prefix = "/images/";

export function setImagePrefix(value: string) {
	prefix = value && !value.endsWith("/") ? value + "/" : value;
	cache.clear();
}

export const getImagePrefix = () => prefix;

const isRemote = (s: string) => /^https?:\/\//i.test(s);

export function extOf(s: string): string {
	const base = s.split("?", 1)[0].split("#", 1)[0];
	const dot = base.lastIndexOf(".");
	return dot >= 0 && dot > base.lastIndexOf("/") ? base.slice(dot).toLowerCase() : "";
}

export const fileName = (s: string) => decodeURIComponent(s.split("?", 1)[0].split("#", 1)[0].split("/").pop() || s);

export type MediaKind = "image" | "video" | "other";

export function mediaKind(s: string): MediaKind {
	const ext = extOf(s);
	if (IMAGE_EXTS.includes(ext)) return "image";
	if (VIDEO_EXTS.includes(ext)) return "video";
	return "other";
}

export function isMediaPath(s: unknown): s is string {
	if (typeof s !== "string") return false;
	if ((prefix && s.startsWith(prefix)) || isRemote(s)) return mediaKind(s) !== "other";
	return false;
}

export const toJsPath = (rel: string) => prefix + rel;

export interface ResolvedMedia {
	src: string | null;
	local: string | null;
	kind: MediaKind;
	error?: string;
}

const cache = new Map<string, Promise<ResolvedMedia>>();

export function resolveMedia(jsPath: string): Promise<ResolvedMedia> {
	const hit = cache.get(jsPath);
	if (hit) return hit;

	const kind = mediaKind(jsPath);
	const p = (async (): Promise<ResolvedMedia> => {
		if (!jsPath) return { src: null, local: null, kind, error: "No media" };
		if (isRemote(jsPath)) return { src: jsPath, local: null, kind };
		if (!prefix || !jsPath.startsWith(prefix)) return { src: null, local: null, kind, error: "Path is outside the media folder" };

		const info = await backend.mediaInfo(decodeURIComponent(jsPath.slice(prefix.length)));
		if (!info.exists) return { src: null, local: info.path, kind, error: "File not found" };
		return { src: backend.fileSrc(info.path), local: info.path, kind };
	})().catch((e) => ({ src: null, local: null, kind, error: String(e) }));

	cache.set(jsPath, p);
	void p.then((r) => r.error && cache.delete(jsPath));
	return p;
}
