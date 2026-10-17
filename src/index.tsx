import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import type { CmsOptions } from "./types";
import { App } from "./ui/App";
import { DialogProvider } from "./ui/dialogs";
import { ToastProvider } from "./ui/toast";
import "./styles.css";

export function mount(target: HTMLElement | string, options: CmsOptions) {
	const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
	if (!el) throw new Error(`Mount target not found: ${String(target)}`);
	createRoot(el).render(
		<StrictMode>
			<ToastProvider>
				<DialogProvider>
					<App options={options} />
				</DialogProvider>
			</ToastProvider>
		</StrictMode>,
	);
}

export { backend } from "./core/backend";
export type { LaunchConfig, ResolvedPaths } from "./core/backend";
export { parseExports, replaceExportValue, serializeValue } from "./core/jsExports";
export type { EntrySchema, ObjectSchema } from "./core/schema";
export { DataStore } from "./core/store";
export type { ExportRef } from "./core/store";
export { JSRaw, JSTemplate, prettyLabel, summarize } from "./core/values";
export type { JSValue } from "./core/values";
export type { ActionContext, CmsOptions, EditorContext, EditorProps, FooterAction, PageEntry } from "./types";
export { Button } from "./ui/common";
export { DocumentEditor } from "./ui/editors/DocumentEditor";
export { GraphEditor } from "./ui/editors/GraphEditor";
export { ImagePicker } from "./ui/editors/Media";
export { MediaListEditor } from "./ui/editors/MediaListEditor";
export { TableEditor } from "./ui/editors/TableEditor";
