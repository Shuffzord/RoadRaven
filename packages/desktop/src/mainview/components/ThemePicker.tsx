import { useEffect, useId, useRef, useState } from "react";
import type { ThemePreference } from "../../../../../shared/types";
import { useTheme } from "../hooks/useTheme";

type ThemeOption = {
	id: ThemePreference;
	label: string;
	/** Primary background — conveys the theme's overall mood */
	bg: string;
	/** Accent / highlight — the pop color */
	accent: string;
};

const THEMES: ThemeOption[] = [
	{ id: "dark", label: "Dark", bg: "#131313", accent: "#4a9eff" },
	{ id: "light", label: "Light", bg: "#ffffff", accent: "#4a9eff" },
	{
		id: "high-contrast",
		label: "High Contrast",
		bg: "#000000",
		accent: "#60b0ff",
	},
	{ id: "paper", label: "Paper", bg: "#f6f3ec", accent: "#9a4a2a" },
	{ id: "amber", label: "Amber", bg: "#1a1612", accent: "#ffa83d" },
	{ id: "contrast", label: "Contrast", bg: "#000000", accent: "#ffe046" },
	{ id: "slate", label: "Slate", bg: "#1e232b", accent: "#e9b675" },
	{ id: "moss", label: "Moss", bg: "#3b4338", accent: "#d4a94e" },
	/* System shows a diagonal dark/light split to signal "follows OS" */
	{ id: "system", label: "System", bg: "#131313", accent: "#ffffff" },
];

function Swatch({ option }: { option: ThemeOption }) {
	const isSystem = option.id === "system";
	return (
		<span
			aria-hidden="true"
			className="inline-flex w-[14px] h-[14px] rounded-[3px] border border-rv-border-subtle overflow-hidden shrink-0"
			style={
				isSystem
					? {
							background: `linear-gradient(135deg, ${option.bg} 50%, ${option.accent} 50%)`,
						}
					: undefined
			}
		>
			{!isSystem && (
				<>
					<span className="flex-1" style={{ background: option.bg }} />
					<span className="flex-1" style={{ background: option.accent }} />
				</>
			)}
		</span>
	);
}

export function ThemePicker() {
	const { preference, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const menuId = useId();

	const activeTheme = THEMES.find((t) => t.id === preference) ?? THEMES[0];

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
				rootRef.current?.querySelector("button")?.focus();
			}
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const startIdx = Math.max(
			0,
			THEMES.findIndex((t) => t.id === preference),
		);
		setFocusIndex(startIdx);
		requestAnimationFrame(() => itemRefs.current[startIdx]?.focus());
	}, [open, preference]);

	const handleMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = (focusIndex + 1) % THEMES.length;
			setFocusIndex(next);
			itemRefs.current[next]?.focus();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = (focusIndex - 1 + THEMES.length) % THEMES.length;
			setFocusIndex(next);
			itemRefs.current[next]?.focus();
		} else if (e.key === "Home") {
			e.preventDefault();
			setFocusIndex(0);
			itemRefs.current[0]?.focus();
		} else if (e.key === "End") {
			e.preventDefault();
			const last = THEMES.length - 1;
			setFocusIndex(last);
			itemRefs.current[last]?.focus();
		}
	};

	const choose = (id: ThemePreference) => {
		setTheme(id);
		setOpen(false);
	};

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				className="flex items-center gap-1.5 h-[28px] px-2 bg-rv-bg-input border border-rv-border rounded-[6px] text-rv-text-secondary hover:text-rv-text-primary transition duration-150"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={menuId}
				aria-label={`Theme: ${activeTheme.label}`}
				onClick={() => setOpen((v) => !v)}
			>
				<Swatch option={activeTheme} />
				<span className="text-[11px] font-semibold tracking-tight">
					{activeTheme.label}
				</span>
				<ChevronDownIcon />
			</button>

			{open && (
				<div
					id={menuId}
					role="menu"
					aria-label="Theme"
					onKeyDown={handleMenuKey}
					className="absolute right-0 top-[calc(100%+4px)] min-w-[180px] bg-rv-bg-elevated border border-rv-border rounded-[6px] py-1 z-50"
					style={{ boxShadow: "var(--rv-shadow-config)" }}
				>
					{THEMES.map((t, i) => {
						const active = t.id === preference;
						return (
							<button
								key={t.id}
								ref={(el) => {
									itemRefs.current[i] = el;
								}}
								type="button"
								role="menuitem"
								className={`flex items-center gap-2 w-full h-[30px] px-2 text-[12px] transition duration-150 ${
									active
										? "text-rv-accent"
										: "text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary"
								}`}
								onClick={() => choose(t.id)}
							>
								<Swatch option={t} />
								<span className="flex-1 text-left">{t.label}</span>
								{active && <CheckIcon />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ChevronDownIcon() {
	return (
		<svg
			aria-hidden="true"
			width="10"
			height="10"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			aria-hidden="true"
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}
