import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { backend } from "../core/backend";
import { setImagePrefix } from "../core/media";
import { type MoveDestination, moveDestinations } from "../core/moves";
import { DataStore, type ExportRef, baseName, refKey, sameRef } from "../core/store";
import type { Path } from "../core/values";
import type { ActionContext, CmsOptions } from "../types";
import { Button, SearchInput } from "./common";
import { useDialogs } from "./dialogs";
import { type MoveDrag, MoveDragContext } from "./dnd";
import { EditorHost } from "./EditorHost";
import { Icon } from "./icons";
import { useNotify } from "./toast";

interface Page {
	ref: ExportRef;
	label: string;
	group: string;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App({ options }: { options: CmsOptions }) {
	const title = options.title ?? "Schema CMS";
	const schemas = options.schemas ?? {};
	const objectSchemas = options.objectSchemas ?? {};
	const editors = options.editors ?? {};

	const store = useMemo(() => new DataStore(), []);
	useSyncExternalStore(store.subscribe, store.getVersion);
	const dialogs = useDialogs();
	const notify = useNotify();

	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [loadError, setLoadError] = useState("");
	const [selected, setSelected] = useState<ExportRef | null>(null);
	const [filter, setFilter] = useState("");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [progress, setProgress] = useState<{ done: number; total: number; label?: string } | null>(null);
	const [drag, setDrag] = useState<{ source: ExportRef; path: Path; row: number; dests: MoveDestination[] } | null>(null);
	const [dropHover, setDropHover] = useState<string | null>(null);
	const lastPageKey = `schema-cms:last-page:${title}`;

	const labelOf = useCallback(
		(name: string) => {
			const l = options.labels;
			if (typeof l === "function") {
				try {
					return String(l(name));
				} catch {
					return name;
				}
			}
			return l?.[name] ?? options.pages?.find((p) => p.export === name)?.label ?? name;
		},
		[options.labels, options.pages],
	);

	const load = useCallback(async () => {
		setStatus("loading");
		try {
			await backend.configure(options.paths ?? {});
			setImagePrefix(options.imagePrefix ?? "/images/");
			await store.load();
			setStatus("ready");
		} catch (e) {
			setLoadError(errorText(e));
			setStatus("error");
		}
	}, [options.paths, options.imagePrefix, store]);

	useEffect(() => {
		void load();
	}, [load]);

	const pages: Page[] = useMemo(() => {
		if (status !== "ready") return [];
		const refs = store.refs();
		if (options.pages?.length) {
			return options.pages.flatMap((p) => {
				const ref = refs.find((r) => r.name === p.export);
				return ref ? [{ ref, label: p.label ?? labelOf(p.export), group: "" }] : [];
			});
		}
		return refs.map((ref) => ({ ref, label: labelOf(ref.name), group: baseName(ref.file) }));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, store.version, options.pages, labelOf]);

	useEffect(() => {
		if (status !== "ready") return;
		if (selected && store.has(selected)) return;
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(lastPageKey);
		} catch {
			/* storage unavailable */
		}
		const next = pages.find((p) => refKey(p.ref) === saved) ?? pages[0];
		setSelected(next ? next.ref : null);
	}, [status, pages, selected, store, lastPageKey]);

	const choose = (ref: ExportRef) => {
		setSelected(ref);
		setSidebarOpen(false);
		try {
			localStorage.setItem(lastPageKey, refKey(ref));
		} catch {
			/* storage unavailable */
		}
	};

	const dirtyCount = status === "ready" ? store.dirtyCount() : 0;

	const save = useCallback(async (): Promise<boolean> => {
		(document.activeElement as HTMLElement | null)?.blur?.();
		try {
			const saved = await store.saveAll();
			notify(saved.length ? `Saved ${saved.length} file${saved.length === 1 ? "" : "s"}` : "No changes to save", "success");
			return true;
		} catch (e) {
			await dialogs.alert("Save failed", `Could not save changes:\n${errorText(e)}`);
			return false;
		}
	}, [store, notify, dialogs]);

	const runSave = useCallback(async () => {
		if (busy) return;
		setBusy("Saving…");
		try {
			await save();
		} finally {
			setBusy(null);
		}
	}, [busy, save]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				if (!document.querySelector(".modal-backdrop")) void runSave();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [runSave]);

	useEffect(() => {
		const t = dirtyCount ? `• ${title}` : title;
		document.title = t;
		void getCurrentWindow()
			.setTitle(t)
			.catch(() => {});
	}, [dirtyCount, title]);

	const guardRef = useRef({ store, save, dialogs });
	guardRef.current = { store, save, dialogs };

	useEffect(() => {
		let closing = false;
		const win = getCurrentWindow();
		const unlisten = win.onCloseRequested(async (event) => {
			const { store, save, dialogs } = guardRef.current;
			if (closing || !store.hasUnsaved()) return;
			event.preventDefault();
			closing = true;
			try {
				const choice = await dialogs.open<"save" | "discard">("Unsaved changes", (close) => (
					<>
						<div className="modal-body modal-message">
							You have {store.dirtyCount()} unsaved change{store.dirtyCount() === 1 ? "" : "s"}. Save before closing?
						</div>
						<div className="modal-footer">
							<Button onClick={() => close(null)}>Cancel</Button>
							<Button variant="danger" onClick={() => close("discard")}>
								Discard
							</Button>
							<Button variant="primary" onClick={() => close("save")}>
								Save
							</Button>
						</div>
					</>
				));
				if (choice === "discard" || (choice === "save" && (await save()))) await win.destroy();
			} finally {
				closing = false;
			}
		});
		return () => void unlisten.then((fn) => fn());
	}, []);

	const reload = async () => {
		if (store.hasUnsaved() && !(await dialogs.confirm({ title: "Reload from disk", message: "Discard all unsaved changes and reload files?", confirmLabel: "Discard & reload", danger: true })))
			return;
		await load();
		notify("Reloaded from disk", "info");
	};

	const performMove = async (source: ExportRef, sourcePath: Path, row: number, dests: MoveDestination[], ask: boolean) => {
		const dest =
			dests.length === 1 && !ask
				? dests[0]
				: await dialogs.choose({
						title: "Move entry",
						label: "Move the selected entry to the top of:",
						options: dests.map((d) => ({ label: d.label, hint: d.file, value: d })),
					});
		if (!dest) return;
		try {
			store.moveItem(source, sourcePath, row, dest.ref, dest.path);
			notify(`Moved entry to ${dest.label}. Save to keep the change.`, "success");
		} catch (e) {
			await dialogs.alert("Move failed", errorText(e));
		}
	};

	const requestMove = async (source: ExportRef, sourcePath: Path, row: number, itemSchema: string | undefined) => {
		let dests;
		try {
			dests = moveDestinations(store, schemas, labelOf, source, sourcePath, itemSchema);
		} catch (e) {
			return dialogs.alert("Move failed", errorText(e));
		}
		if (!dests.length) return dialogs.alert("Move entry", "No compatible destination page or group is available.");
		return performMove(source, sourcePath, row, dests, true);
	};

	const moveDragApi = useMemo<MoveDrag | null>(
		() =>
			selected
				? {
						start: (path, row, itemSchema) => {
							try {
								const dests = moveDestinations(store, schemas, labelOf, selected, path, itemSchema);
								setDrag({ source: selected, path, row, dests });
							} catch {
								setDrag(null);
							}
						},
						end: () => {
							setDrag(null);
							setDropHover(null);
						},
					}
				: null,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[selected, store, labelOf],
	);

	const destsFor = (ref: ExportRef) => drag?.dests.filter((d) => sameRef(d.ref, ref)) ?? [];

	const runAction = async (run: (ctx: ActionContext) => Promise<void>, label: string) => {
		if (busy) return;
		setBusy(label);
		setProgress(null);
		try {
			await run({
				store,
				dialogs,
				notify,
				save,
				setProgress: (done, total, l) => setProgress({ done, total, label: l }),
			});
		} catch (e) {
			await dialogs.alert(`${label} failed`, errorText(e));
		} finally {
			setBusy(null);
			setProgress(null);
		}
	};

	if (status === "loading") return <div className="splash">Loading…</div>;
	if (status === "error")
		return (
			<div className="splash splash-error">
				<Icon name="alert" size={28} />
				<h1>Could not open the data folder</h1>
				<pre>{loadError}</pre>
				<Button variant="primary" onClick={load}>
					Retry
				</Button>
			</div>
		);

	const f = filter.trim().toLowerCase();
	const shown = pages.filter((p) => !f || p.label.toLowerCase().includes(f) || p.ref.name.toLowerCase().includes(f));
	const groups = [...new Set(shown.map((p) => p.group))];
	const current = selected && store.has(selected) ? selected : null;
	const currentPage = current ? pages.find((p) => sameRef(p.ref, current)) : undefined;
	const currentLabel = currentPage?.label ?? (current ? labelOf(current.name) : "");

	return (
		<div className={`app ${sidebarOpen ? "sidebar-open" : ""}`}>
			<aside className="sidebar">
				<div className="sidebar-head">
					<div className="app-title">{title}</div>
					<button type="button" className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
						<Icon name="close" />
					</button>
				</div>
				<div className="sidebar-search">
					<SearchInput value={filter} onChange={setFilter} placeholder="Find a page…" />
				</div>
				{drag && <div className="drop-hint">{drag.dests.length ? "Drop on a highlighted page to move the entry there" : "No other page accepts this entry"}</div>}
				<nav className="page-list">
					{groups.map((g) => (
						<div key={g} className="page-group">
							{g && <div className="page-group-title">{g}</div>}
							{shown
								.filter((p) => p.group === g)
								.map((p) => (
									<button
										type="button"
										key={refKey(p.ref)}
										className={`page ${sameRef(p.ref, current) ? "active" : ""} ${
											drag ? (destsFor(p.ref).length ? (dropHover === refKey(p.ref) ? "drop-ok drop-hover" : "drop-ok") : "drop-no") : ""
										}`}
										onClick={() => choose(p.ref)}
										onDragOver={(e) => {
											if (!destsFor(p.ref).length) return;
											e.preventDefault();
											e.dataTransfer.dropEffect = "move";
											if (dropHover !== refKey(p.ref)) setDropHover(refKey(p.ref));
										}}
										onDragLeave={() => dropHover === refKey(p.ref) && setDropHover(null)}
										onDrop={(e) => {
											e.preventDefault();
											const d = drag;
											const dests = destsFor(p.ref);
											setDrag(null);
											setDropHover(null);
											if (d && dests.length) void performMove(d.source, d.path, d.row, dests, false);
										}}
										title={`${p.ref.name} · ${baseName(p.ref.file)}`}
									>
										<span className="page-label">{p.label}</span>
										{store.isDirty(p.ref) && <span className="dirty-dot" title="Unsaved changes" />}
									</button>
								))}
						</div>
					))}
					{!shown.length && <div className="muted page-empty">{pages.length ? "No pages match." : "No data entries found."}</div>}
					{store.errors.map((e) => (
						<div key={e.file} className="page-error" title={e.message}>
							<Icon name="alert" size={14} />
							<span>
								{baseName(e.file)} could not be parsed
								<small>{e.message}</small>
							</span>
						</div>
					))}
				</nav>
				<div className="sidebar-foot">
					<Button size="sm" variant="ghost" onClick={reload} disabled={!!busy}>
						Reload from disk
					</Button>
				</div>
			</aside>
			<div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />

			<main className="main">
				<header className="header">
					<button type="button" className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
						<Icon name="menu" />
					</button>
					<div className="header-text">
						<h1>{currentLabel || "Select a page"}</h1>
						{current && (
							<div className="crumb">
								{baseName(current.file)} <span className="crumb-sep">/</span> {current.name}
							</div>
						)}
					</div>
					{current && store.isDirty(current) && <span className="badge">Unsaved</span>}
				</header>

				<div className={`content ${busy ? "is-busy" : ""}`} inert={busy ? true : undefined}>
					{current ? (
						<MoveDragContext.Provider value={moveDragApi}>
						<EditorHost
							key={refKey(current)}
							exportRef={current}
							value={store.get(current)}
							label={currentLabel}
							schemas={schemas}
							objectSchemas={objectSchemas}
							editors={editors}
							onChange={(v) => store.set(current, v)}
							onMove={(path, row, schema) => requestMove(current, path, row, schema)}
						/>
						</MoveDragContext.Provider>
					) : (
						<div className="empty">Select a page from the sidebar.</div>
					)}
				</div>

				<footer className="footer">
					<div className="footer-status">
						{busy ? (
							<span>{progress?.label ?? busy}</span>
						) : dirtyCount ? (
							<span>
								<span className="dirty-dot" /> {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
							</span>
						) : (
							<span className="muted">All changes saved</span>
						)}
					</div>
					{busy && (
						<div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress?.total || undefined} aria-valuenow={progress?.done}>
							<div
								className={`progress-bar ${progress && progress.total > 0 ? "" : "indeterminate"}`}
								style={progress && progress.total > 0 ? { width: `${Math.min(100, (progress.done / progress.total) * 100)}%` } : undefined}
							/>
						</div>
					)}
					<div className="footer-actions">
						{options.actions?.map((a) => (
							<Button key={a.id} icon={a.icon} onClick={() => runAction(a.run, a.label)} disabled={!!busy}>
								{a.label}
							</Button>
						))}
						<Button icon="save" variant="primary" onClick={runSave} disabled={!!busy} title="Save (Ctrl+S)">
							Save
						</Button>
					</div>
				</footer>
			</main>
		</div>
	);
}
