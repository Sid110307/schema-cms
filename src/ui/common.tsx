import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

import { Icon, type IconName } from "./icons";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon?: IconName;
	variant?: "default" | "primary" | "danger" | "ghost";
	size?: "sm" | "md";
	iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ icon, variant = "default", size = "md", iconOnly, children, className, type = "button", ...rest },
	ref,
) {
	const cls = ["btn", `btn-${variant}`, `btn-${size}`, iconOnly ? "btn-icon" : "", className ?? ""].filter(Boolean).join(" ");
	return (
		<button ref={ref} type={type} className={cls} {...rest}>
			{icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
			{!iconOnly && children !== undefined && <span>{children}</span>}
		</button>
	);
});

export function Toolbar({ children }: { children: ReactNode }) {
	return <div className="toolbar">{children}</div>;
}

export const Spacer = () => <div className="spacer" />;

export function Empty({ children, icon }: { children: ReactNode; icon?: IconName }) {
	return (
		<div className="empty">
			{icon && <Icon name={icon} size={28} />}
			<div>{children}</div>
		</div>
	);
}

export function SearchInput({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
	return (
		<label className="search">
			<Icon name="search" size={14} />
			<input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
			{value && (
				<button type="button" className="search-clear" onClick={() => onChange("")} aria-label="Clear search">
					<Icon name="close" size={12} />
				</button>
			)}
		</label>
	);
}
