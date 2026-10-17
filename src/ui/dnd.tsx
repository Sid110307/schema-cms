import { type DragEvent, createContext, useContext, useState } from "react";

import type { Path } from "../core/values";

export interface MoveDrag {
	start(sourcePath: Path, row: number, itemSchema: string): void;
	end(): void;
}

export const MoveDragContext = createContext<MoveDrag | null>(null);

export const useMoveDrag = () => useContext(MoveDragContext);

interface DragState {
	from: number;
	over: number;
	after: boolean;
}

export function useReorder(onMove: (from: number, to: number) => void, opts: { enabled?: boolean; onStart?: (i: number) => void; onEnd?: () => void } = {}) {
	const [drag, setDrag] = useState<DragState | null>(null);
	const enabled = opts.enabled ?? true;

	const finish = () => {
		setDrag(null);
		opts.onEnd?.();
	};

	const itemProps = (i: number) => ({
		draggable: true,
		onDragStart: (e: DragEvent<HTMLElement>) => {
			e.stopPropagation();
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", String(i));
			setDrag({ from: i, over: i, after: false });
			opts.onStart?.(i);
		},
		onDragOver: (e: DragEvent<HTMLElement>) => {
			if (!drag || !enabled) return;
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = "move";
			const rect = e.currentTarget.getBoundingClientRect();
			const after = e.clientY > rect.top + rect.height / 2;
			if (drag.over !== i || drag.after !== after) setDrag({ ...drag, over: i, after });
		},
		onDrop: (e: DragEvent<HTMLElement>) => {
			if (!drag || !enabled) return;
			e.preventDefault();
			e.stopPropagation();
			let to = drag.over + (drag.after ? 1 : 0);
			if (drag.from < to) to--;
			if (to !== drag.from) onMove(drag.from, to);
			finish();
		},
		onDragEnd: finish,
	});

	const dropClass = (i: number) => {
		if (!drag) return "";
		if (drag.from === i) return "dragging";
		if (!enabled || drag.over !== i) return "";
		return drag.after ? "drop-after" : "drop-before";
	};

	return { itemProps, dropClass, dragging: drag !== null };
}
