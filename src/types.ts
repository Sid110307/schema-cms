import type { ComponentType } from "react";

import type { ResolvedPaths } from "./core/backend";
import type { EntrySchema, ObjectSchema } from "./core/schema";
import type { DataStore, ExportRef } from "./core/store";
import type { JSValue, Path } from "./core/values";
import type { Dialogs } from "./ui/dialogs";
import type { ToastKind } from "./ui/toast";
import type { IconName } from "./ui/icons";

export interface PageEntry {
	export: string;
	label?: string;
}

export interface ActionContext {
	store: DataStore;
	dialogs: Dialogs;
	save(): Promise<boolean>;
	setProgress(done: number, total: number, label?: string): void;
	notify(message: string, kind?: ToastKind): void;
}

export interface FooterAction {
	id: string;
	label: string;
	icon?: IconName;
	run(ctx: ActionContext): Promise<void>;
}

export interface EditorContext {
	schema: EntrySchema;
	titleField: string;
	itemSchema?: string;
	objectSchemas: Record<string, ObjectSchema>;
}

export interface EditorProps {
	exportRef: ExportRef;
	value: JSValue;
	context: EditorContext;
	onChange(value: JSValue): void;
}

export interface CmsOptions {
	title?: string;
	paths?: Partial<ResolvedPaths>;
	imagePrefix?: string;
	schemas?: Record<string, EntrySchema>;
	objectSchemas?: Record<string, ObjectSchema>;
	pages?: PageEntry[];
	labels?: Record<string, string> | ((exportName: string) => string);
	actions?: FooterAction[];
	editors?: Record<string, ComponentType<EditorProps>>;
}

export type MoveRequest = (sourcePath: Path, row: number, itemSchema: string | undefined) => void;
