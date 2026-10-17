import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "./common";
import { Icon } from "./icons";

type Close<T> = (value: T | null) => void;

interface DialogEntry {
	id: number;
	title: string;
	wide?: boolean;
	render: (close: Close<unknown>) => ReactNode;
	resolve: (value: unknown) => void;
}

export interface ChooseOption<T> {
	label: string;
	value: T;
	hint?: string;
}

export interface Dialogs {
	open<T>(title: string, render: (close: Close<T>) => ReactNode, opts?: { wide?: boolean }): Promise<T | null>;
	alert(title: string, message: ReactNode): Promise<void>;
	confirm(opts: { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }): Promise<boolean>;
	prompt(opts: { title: string; label: string; initial?: string; placeholder?: string; validate?: (v: string) => string | null }): Promise<string | null>;
	choose<T>(opts: { title: string; label?: string; options: ChooseOption<T>[] }): Promise<T | null>;
}

const DialogContext = createContext<Dialogs | null>(null);

export function useDialogs() {
	const ctx = useContext(DialogContext);
	if (!ctx) throw new Error("useDialogs must be used inside DialogProvider");
	return ctx;
}

export function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
	const panel = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const prev = document.activeElement as HTMLElement | null;
		const el = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select, .btn-primary");
		el?.focus();
		return () => prev?.focus?.();
	}, []);

	return (
		<div
			className="modal-backdrop"
			onMouseDown={(e) => e.target === e.currentTarget && onClose()}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					e.stopPropagation();
					onClose();
				}
			}}
		>
			<div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={panel}>
				<div className="modal-header">
					<h2>{title}</h2>
					<button type="button" className="modal-x" onClick={onClose} aria-label="Close">
						<Icon name="close" />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

function PromptBody({ label, initial, placeholder, validate, close }: {
	label: string;
	initial?: string;
	placeholder?: string;
	validate?: (v: string) => string | null;
	close: Close<string>;
}) {
	const [value, setValue] = useState(initial ?? "");
	const [error, setError] = useState<string | null>(null);
	const submit = () => {
		const err = validate?.(value) ?? null;
		if (err) setError(err);
		else close(value);
	};
	return (
		<form onSubmit={(e) => (e.preventDefault(), submit())}>
			<div className="modal-body">
				<label className="field">
					<span className="field-label">{label}</span>
					<input value={value} placeholder={placeholder} onChange={(e) => (setValue(e.target.value), setError(null))} />
				</label>
				{error && <div className="form-error">{error}</div>}
			</div>
			<div className="modal-footer">
				<Button onClick={() => close(null)}>Cancel</Button>
				<Button type="submit" variant="primary">
					OK
				</Button>
			</div>
		</form>
	);
}

function ChooseBody<T>({ label, options, close }: { label?: string; options: ChooseOption<T>[]; close: Close<T> }) {
	const [sel, setSel] = useState(0);
	return (
		<form onSubmit={(e) => (e.preventDefault(), close(options[sel]?.value ?? null))}>
			<div className="modal-body">
				{label && <div className="field-label">{label}</div>}
				<div className="choice-list" role="listbox">
					{options.map((o, i) => (
						<button
							type="button"
							key={i}
							role="option"
							aria-selected={i === sel}
							className={`choice ${i === sel ? "selected" : ""}`}
							data-autofocus={i === 0 ? true : undefined}
							onClick={() => setSel(i)}
							onDoubleClick={() => close(o.value)}
							onKeyDown={(e) => {
								if (e.key === "ArrowDown" || e.key === "ArrowUp") {
									e.preventDefault();
									const next = Math.max(0, Math.min(options.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
									setSel(next);
									(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
								}
							}}
						>
							<span>{o.label}</span>
							{o.hint && <span className="choice-hint">{o.hint}</span>}
						</button>
					))}
				</div>
			</div>
			<div className="modal-footer">
				<Button onClick={() => close(null)}>Cancel</Button>
				<Button type="submit" variant="primary" disabled={!options.length}>
					Select
				</Button>
			</div>
		</form>
	);
}

export function DialogProvider({ children }: { children: ReactNode }) {
	const [stack, setStack] = useState<DialogEntry[]>([]);
	const nextId = useRef(1);

	const open = useCallback(<T,>(title: string, render: (close: Close<T>) => ReactNode, opts?: { wide?: boolean }) => {
		return new Promise<T | null>((resolve) => {
			const id = nextId.current++;
			setStack((s) => [...s, { id, title, wide: opts?.wide, render: render as (c: Close<unknown>) => ReactNode, resolve: resolve as (v: unknown) => void }]);
		});
	}, []);

	const api = useMemo<Dialogs>(
		() => ({
			open,
			alert: async (title, message) => {
				await open<true>(title, (close) => (
					<>
						<div className="modal-body modal-message">{message}</div>
						<div className="modal-footer">
							<Button variant="primary" onClick={() => close(true)}>
								OK
							</Button>
						</div>
					</>
				));
			},
			confirm: async ({ title, message, confirmLabel = "OK", danger }) =>
				!!(await open<true>(title, (close) => (
					<>
						<div className="modal-body modal-message">{message}</div>
						<div className="modal-footer">
							<Button onClick={() => close(null)}>Cancel</Button>
							<Button variant={danger ? "danger" : "primary"} onClick={() => close(true)}>
								{confirmLabel}
							</Button>
						</div>
					</>
				))),
			prompt: (opts) => open<string>(opts.title, (close) => <PromptBody {...opts} close={close} />),
			choose: (opts) => open(opts.title, (close) => <ChooseBody label={opts.label} options={opts.options} close={close} />),
		}),
		[open],
	);

	const closeTop = (entry: DialogEntry, value: unknown) => {
		setStack((s) => s.filter((d) => d.id !== entry.id));
		entry.resolve(value);
	};

	return (
		<DialogContext.Provider value={api}>
			{children}
			{stack.map((d) => (
				<Modal key={d.id} title={d.title} wide={d.wide} onClose={() => closeTop(d, null)}>
					{d.render((v) => closeTop(d, v))}
				</Modal>
			))}
		</DialogContext.Provider>
	);
}
