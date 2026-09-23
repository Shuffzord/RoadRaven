import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
	ThemePreference,
	UserThemeEntry,
} from "../../../../../shared/types";
import { useTheme } from "../hooks/useTheme";
import { useThemeStore } from "../store/themeStore";
import { BUILT_IN_THEMES, DEFAULT_THEME_ID, themeForId } from "../themes";

// Contract constants (tests/unit/ui/ThemePicker.test.tsx imports these).
export const THEME_GROUP_BUILT_IN = "Built-in";
export const THEME_GROUP_USER = "Your themes";
export const THEME_BADGE_TESTID = "theme-badge";

type ThemeOption = {
	id: ThemePreference;
	label: string;
	/** Primary background — conveys the theme's overall mood */
	bg: string;
	/** Accent / highlight — the pop color */
	accent: string;
	/** Why the file cannot be used at all (invalid, no last good version). */
	disabled?: boolean;
	/** Badge text: the file's error, or its required contrast failures. */
	warning?: string;
};

// Registry-driven (v0.8.3 Phase 3, D5): the swatch is the theme's own
// bg-base and accent, so it cannot drift from what the theme paints.
const BUILT_IN_OPTIONS: ThemeOption[] = [
	...BUILT_IN_THEMES.map((t) => ({
		id: t.id,
		label: t.meta.name,
		bg: t.colors["bg-base"],
		accent: t.colors.accent,
	})),
	/* System shows a diagonal dark/light split to signal "follows OS" */
	{
		id: "system",
		label: "System",
		bg: themeForId("dark").colors["bg-base"],
		accent: themeForId("light").colors["bg-base"],
	},
];

function contrastWarning(failures: number | undefined): string | undefined {
	if (!failures) return undefined;
	return `${failures} required contrast pair${failures === 1 ? " fails" : "s fail"}`;
}

/** A user file as a picker option (v0.8.3 Phase 4); an invalid one is inert. */
function userOption(entry: UserThemeEntry): ThemeOption {
	return {
		id: entry.id,
		label: entry.file?.meta.name ?? entry.id,
		bg: entry.file?.colors["bg-base"] ?? "var(--rv-bg-input)",
		accent: entry.file?.colors.accent ?? "var(--rv-border)",
		disabled: !entry.file,
		warning: entry.error ?? contrastWarning(entry.requiredFailures),
	};
}

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
	const userThemes = useThemeStore((s) => s.userThemes);
	const [open, setOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const menuId = useId();

	const userOptions = useMemo(() => userThemes.map(userOption), [userThemes]);
	const options = useMemo(
		() => [...BUILT_IN_OPTIONS, ...userOptions],
		[userOptions],
	);

	// An unknown preference paints the default (themeStore), so show that.
	const activeTheme =
		options.find((t) => t.id === preference && !t.disabled) ??
		options.find((t) => t.id === DEFAULT_THEME_ID) ??
		options[0];

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
			options.findIndex((t) => t.id === preference),
		);
		setFocusIndex(startIdx);
		requestAnimationFrame(() => itemRefs.current[startIdx]?.focus());
	}, [open, preference, options]);

	const focusItem = (index: number) => {
		setFocusIndex(index);
		itemRefs.current[index]?.focus();
	};

	const handleMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
		const count = options.length;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			focusItem((focusIndex + 1) % count);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			focusItem((focusIndex - 1 + count) % count);
		} else if (e.key === "Home") {
			e.preventDefault();
			focusItem(0);
		} else if (e.key === "End") {
			e.preventDefault();
			focusItem(count - 1);
		}
	};

	const choose = (option: ThemeOption) => {
		if (option.disabled) return;
		setTheme(option.id);
		setOpen(false);
	};

	const renderItem = (t: ThemeOption, i: number) => {
		const active = t.id === preference;
		const reasonId = t.warning ? `${menuId}-${t.id}-reason` : undefined;
		return (
			<button
				key={t.id}
				ref={(el) => {
					itemRefs.current[i] = el;
				}}
				type="button"
				role="menuitem"
				aria-disabled={t.disabled || undefined}
				aria-describedby={reasonId}
				className={`flex items-center gap-2 w-full h-[30px] px-2 text-[12px] transition duration-150 ${
					active
						? "text-rv-accent"
						: "text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary"
				}`}
				onClick={() => choose(t)}
			>
				<Swatch option={t} />
				<span className="flex-1 text-left">{t.label}</span>
				{t.warning && (
					<>
						<span
							data-testid={THEME_BADGE_TESTID}
							title={t.warning}
							aria-hidden="true"
							className={`inline-flex items-center justify-center w-[14px] h-[14px] rounded-full text-[9px] font-bold ${
								t.disabled
									? "bg-rv-status-blocked-bg text-rv-status-blocked"
									: "bg-rv-status-in-progress-bg text-rv-status-in-progress"
							}`}
						>
							!
						</span>
						<span id={reasonId} hidden>
							{t.warning}
						</span>
					</>
				)}
				{active && <CheckIcon />}
			</button>
		);
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
					{/* fieldset = role "group" (biome useSemanticElements); reset to a plain box */}
					<fieldset
						aria-label={THEME_GROUP_BUILT_IN}
						className="m-0 p-0 border-0 min-w-0"
					>
						{BUILT_IN_OPTIONS.map(renderItem)}
					</fieldset>
					{userOptions.length > 0 && (
						<fieldset
							aria-label={THEME_GROUP_USER}
							className="m-0 p-0 mt-1 pt-1 min-w-0 border-0 border-t border-solid border-rv-border-subtle"
						>
							{userOptions.map((t, i) =>
								renderItem(t, BUILT_IN_OPTIONS.length + i),
							)}
						</fieldset>
					)}
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
