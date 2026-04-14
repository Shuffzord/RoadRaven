import { useTheme } from "../hooks/useTheme";

export function TopBar() {
	const { preference, setTheme } = useTheme();

	return (
		<header
			className="[grid-area:topbar] flex items-center h-[50px] bg-rv-bg-toolbar border-b border-rv-border px-3 gap-1 z-[100] select-none"
			role="toolbar"
			aria-label="Main toolbar"
		>
			{/* Brand */}
			<div className="flex items-center gap-1.5 shrink-0">
				<svg
					aria-hidden="true"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-rv-accent"
				>
					<path d="M3 12h4l3-9 4 18 3-9h4" />
				</svg>
				<span className="text-[14px] font-semibold tracking-tight text-rv-text-primary">
					RoadRaven
				</span>
			</div>

			{/* Separator */}
			<div className="w-px h-6 bg-rv-border mx-1.5 shrink-0" />

			{/* Action buttons */}
			<button
				className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-[12px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				type="button"
			>
				<svg
					aria-hidden="true"
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="12" y1="18" x2="12" y2="12" />
					<line x1="9" y1="15" x2="15" y2="15" />
				</svg>
				New
			</button>
			<button
				className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-[12px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				type="button"
			>
				<svg
					aria-hidden="true"
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
				</svg>
				Open
			</button>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Search */}
			<search className="relative flex items-center">
				<input
					className="w-[220px] h-[30px] bg-rv-bg-input border border-rv-border rounded-lg px-3 pr-14 text-[12px] text-rv-text-primary placeholder:text-rv-text-tertiary outline-none focus:border-rv-border-focus"
					type="text"
					placeholder="Search nodes..."
					aria-label="Search nodes"
				/>
				<kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] bg-rv-bg-elevated rounded-[3px] px-1.5 py-0.5 text-rv-text-tertiary pointer-events-none">
					Ctrl+F
				</kbd>
			</search>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Fit button */}
			<button
				className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-[12px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				type="button"
			>
				Fit
			</button>

			{/* Zoom buttons */}
			<button
				className="flex items-center justify-center w-[26px] h-[26px] rounded-[5px] text-rv-text-secondary hover:bg-rv-bg-hover transition-all duration-150"
				type="button"
				aria-label="Zoom out"
			>
				<svg
					aria-hidden="true"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
			<button
				className="flex items-center justify-center w-[26px] h-[26px] rounded-[5px] text-rv-text-secondary hover:bg-rv-bg-hover transition-all duration-150"
				type="button"
				aria-label="Zoom in"
			>
				<svg
					aria-hidden="true"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>

			{/* Layout toggle */}
			<ToggleGroup
				label="Tree layout direction"
				options={[
					{ value: "TB", label: "TB" },
					{ value: "LR", label: "LR" },
				]}
				active="TB"
			/>

			{/* Theme switcher */}
			<div
				className="flex items-center bg-rv-bg-input border border-rv-border rounded-[6px] h-[28px]"
				role="radiogroup"
				aria-label="Theme switcher"
			>
				<ThemeButton
					active={preference === "dark"}
					onClick={() => setTheme("dark")}
					label="Dark theme"
					icon={<MoonIcon />}
				/>
				<ThemeButton
					active={preference === "light"}
					onClick={() => setTheme("light")}
					label="Light theme"
					icon={<SunIcon />}
				/>
				<ThemeButton
					active={preference === "high-contrast"}
					onClick={() => setTheme("high-contrast")}
					label="High contrast theme"
					icon={<EyeIcon />}
				/>
				<ThemeButton
					active={preference === "system"}
					onClick={() => setTheme("system")}
					label="System theme"
					icon={<MonitorIcon />}
				/>
			</div>

			{/* Settings */}
			<button
				className="flex items-center justify-center w-[30px] h-[30px] rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				type="button"
				aria-label="Settings"
			>
				<svg
					aria-hidden="true"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</button>
		</header>
	);
}

/* ---- Sub-components ---- */

function ToggleGroup({
	label,
	options,
	active,
}: {
	label: string;
	options: { value: string; label: string }[];
	active: string;
}) {
	return (
		<div
			className="flex items-center bg-rv-bg-input border border-rv-border rounded-[6px] h-[28px]"
			role="radiogroup"
			aria-label={label}
		>
			{options.map((opt) => (
				<button
					key={opt.value}
					className={`px-2.5 h-full text-[11px] font-semibold transition duration-150 ${
						active === opt.value
							? "bg-rv-accent-muted text-rv-accent"
							: "text-rv-text-tertiary hover:text-rv-text-secondary"
					}`}
					type="button"
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

function ThemeButton({
	active,
	onClick,
	label,
	icon,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	icon: React.ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: custom styled radio buttons cannot use input[type=radio]
		<button
			className={`flex items-center justify-center w-[30px] h-[28px] transition duration-150 ${
				active
					? "bg-rv-accent-muted text-rv-accent"
					: "text-rv-text-tertiary hover:text-rv-text-secondary"
			}`}
			type="button"
			role="radio"
			aria-checked={active}
			aria-label={label}
			onClick={onClick}
		>
			{icon}
		</button>
	);
}

/* ---- Icons (Lucide-style, 14x14) ---- */

function MoonIcon() {
	return (
		<svg
			aria-hidden="true"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	);
}

function SunIcon() {
	return (
		<svg
			aria-hidden="true"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	);
}

function EyeIcon() {
	return (
		<svg
			aria-hidden="true"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function MonitorIcon() {
	return (
		<svg
			aria-hidden="true"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
	);
}
