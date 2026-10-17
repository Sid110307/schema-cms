const PATHS = {
	plus: "M12 5v14M5 12h14",
	edit: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4zM13.5 6.5l4 4",
	trash: "M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
	up: "M12 19V5M6 11l6-6 6 6",
	down: "M12 5v14M6 13l6 6 6-6",
	move: "M14 4l4 4-4 4M18 8H6M10 20l-4-4 4-4M6 16h12",
	save: "M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3zM8 3v5h7V3M8 21v-7h8v7",
	upload: "M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
	folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z",
	file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5",
	image: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 15l-5-5L5 20",
	video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 10l5-3v10l-5-3",
	chevron: "M9 6l6 6-6 6",
	close: "M6 6l12 12M18 6L6 18",
	menu: "M4 6h16M4 12h16M4 18h16",
	alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
	check: "M5 12l5 5L20 7",
	grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
	link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
	return (
		<svg
			className="icon"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={PATHS[name]} />
		</svg>
	);
}
