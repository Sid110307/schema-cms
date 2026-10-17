import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";

import { Icon } from "./icons";

export type ToastKind = "info" | "success" | "error";

interface Toast {
	id: number;
	kind: ToastKind;
	message: string;
}

type Notify = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<Notify>(() => {});

export const useNotify = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const nextId = useRef(1);

	const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

	const notify = useCallback<Notify>(
		(message, kind = "info") => {
			const id = nextId.current++;
			setToasts((t) => [...t.slice(-3), { id, kind, message }]);
			setTimeout(() => dismiss(id), kind === "error" ? 9000 : 4500);
		},
		[dismiss],
	);

	return (
		<ToastContext.Provider value={notify}>
			{children}
			<div className="toasts" aria-live="polite">
				{toasts.map((t) => (
					<div key={t.id} className={`toast toast-${t.kind}`}>
						<Icon name={t.kind === "error" ? "alert" : "check"} />
						<span>{t.message}</span>
						<button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
							<Icon name="close" size={12} />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
