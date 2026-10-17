import { convertFileSrc, invoke } from "@tauri-apps/api/core";

const cmd = <T>(name: string, args?: Record<string, unknown>) => invoke<T>(`plugin:schema-cms|${name}`, args);

export interface ResolvedPaths {
	dataDir: string;
	entryGlob: string;
	imagesDir: string;
}

export interface LaunchConfig {
	config: Record<string, unknown> | null;
	configDir: string;
	env: Record<string, string>;
}

export interface MediaInfo {
	path: string;
	exists: boolean;
}

export const backend = {
	configure: (paths: Partial<ResolvedPaths>) => cmd<ResolvedPaths>("configure", { paths }),
	launchConfig: () => cmd<LaunchConfig>("launch_config"),
	listFiles: () => cmd<string[]>("list_files"),
	readFile: (path: string) => cmd<string>("read_file", { path }),
	saveFiles: (files: { path: string; text: string }[]) => cmd<void>("save_files", { files }),
	mediaInfo: (rel: string) => cmd<MediaInfo>("media_info", { rel }),
	pickMedia: (multiple: boolean) => cmd<{ rel: string[]; rejected: string[] } | null>("pick_media", { multiple }),
	fileSrc: (path: string) => convertFileSrc(path),
};
