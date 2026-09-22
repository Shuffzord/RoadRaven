import { useEffect, useRef } from "react";
import ravenLogo from "../assets/raven-logo.svg";
import { electroview } from "../rpc";
import { useEventLogStore } from "../store/eventLogStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useRoadmapStore } from "../store/roadmapStore";
import { DocumentChip } from "./DocumentChip";
import { FileMenu } from "./FileMenu";
import { ThemePicker } from "./ThemePicker";

export function TopBar() {
	const layoutOrientation = useRoadmapStore((s) => s.layoutOrientation);
	const setLayout = useRoadmapStore((s) => s.setLayout);
	const filePath = useRoadmapStore((s) => s.filePath);
	const isDrawerOpen = useEventLogStore((s) => s.isOpen);

	const handleLayoutChange = (value: "TB" | "LR") => {
		setLayout(value);
		if (filePath) {
			electroview?.rpc?.request.saveSettings({
				settings: { fileSettings: { [filePath]: { layout: value } } },
			});
		}
	};

	// v0.8.1 Phase 5 (D3): one "Fit to View". This used to call `resetView`,
	// which set a translate from window.innerWidth and zoom 0.8 — a fixed
	// camera that never looked at where the tree was. `fitView` asks the canvas
	// to fit the bounding box of the cards that are actually mounted.
	const handleFitView = () => {
		useRoadmapStore.getState().fitView();
	};

	return (
		<header
			className="[grid-area:topbar] flex items-center h-[50px] bg-rv-bg-toolbar border-b border-rv-border px-3 gap-1 z-[100] select-none"
			role="toolbar"
			aria-label="Main toolbar"
		>
			{/* Brand */}
			<div className="flex items-center gap-1.5 shrink-0">
				<div
					aria-hidden="true"
					className="w-[35px] h-[35px] bg-rv-accent"
					style={{
						maskImage: `url(${ravenLogo})`,
						maskSize: "contain",
						maskRepeat: "no-repeat",
						maskPosition: "center",
						WebkitMaskImage: `url(${ravenLogo})`,
						WebkitMaskSize: "contain",
						WebkitMaskRepeat: "no-repeat",
						WebkitMaskPosition: "center",
					}}
				/>
				<span className="text-[14px] font-semibold tracking-tight text-rv-text-primary">
					RoadRaven
				</span>
			</div>

			{/* Separator */}
			<div className="w-px h-6 bg-rv-border mx-1.5 shrink-0" />

			{/* File menu (v0.8.2 D2-A): every file verb, from the fileCommands registry */}
			<FileMenu>
				<button
					className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-[12px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
					type="button"
				>
					File
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
				</button>
			</FileMenu>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Document identity (D3) + search */}
			<div className="flex items-center gap-2 min-w-0">
				<DocumentChip />
				<SearchBox />
			</div>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Events toggle button (D-18) */}
			<button
				type="button"
				aria-label="Toggle event log drawer"
				title="Toggle event log drawer (Ctrl+Shift+L)"
				onClick={() => useEventLogStore.getState().toggleOpen()}
				style={{
					color: isDrawerOpen ? "var(--rv-accent)" : undefined,
					borderBottom: isDrawerOpen
						? "1px solid var(--rv-accent)"
						: "1px solid transparent",
				}}
				className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-[12px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
			>
				<svg
					aria-hidden="true"
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					<line x1="4" y1="12" x2="4" y2="8" />
					<line x1="8" y1="12" x2="8" y2="5" />
					<line x1="12" y1="12" x2="12" y2="9" />
				</svg>
				Events
			</button>

			{/* Fit button */}
			<button
				className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-[6px] text-[12px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				type="button"
				onClick={handleFitView}
			>
				Fit
			</button>

			{/* Zoom buttons (F6): one step about the container centre, via the store */}
			<button
				className="flex items-center justify-center w-[26px] h-[26px] rounded-[5px] text-rv-text-secondary hover:bg-rv-bg-hover transition-all duration-150"
				type="button"
				aria-label="Zoom out"
				onClick={() => useRoadmapStore.getState().requestZoom("out")}
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
				onClick={() => useRoadmapStore.getState().requestZoom("in")}
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
				active={layoutOrientation}
				onChange={(value) => handleLayoutChange(value as "TB" | "LR")}
			/>

			{/* Theme picker */}
			<ThemePicker />

			{/* Preferences (v0.8.2 D5-A); the setup wizard lives under Integrations */}
			<button
				className="flex items-center justify-center w-[30px] h-[30px] rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				type="button"
				aria-label="Preferences"
				title="Preferences (Ctrl+,)"
				onClick={() => usePreferencesStore.getState().openPreferences()}
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

// Enter → next match (Shift+Enter → previous, wraps); Escape → clear + blur.
// Extracted from SearchBox so the component body stays flat (low complexity).
function handleSearchKeyDown(
	e: React.KeyboardEvent<HTMLInputElement>,
	stepSearchMatch: (delta: number) => void,
	clearSearch: () => void,
): void {
	if (e.key === "Enter") {
		e.preventDefault();
		stepSearchMatch(e.shiftKey ? -1 : 1);
	} else if (e.key === "Escape") {
		e.preventDefault();
		clearSearch();
		e.currentTarget.blur();
	}
}

// Header node-search box. Owns the controlled input + match counter; the
// camera follow + canvas highlight live in Canvas, driven by the store's
// searchMatchIds / searchCurrentIndex. Ctrl+F (from useKeyboardRouter) fires
// the `roadraven:focus-search` event this component listens for.
function SearchBox() {
	const searchQuery = useRoadmapStore((s) => s.searchQuery);
	const matchCount = useRoadmapStore((s) => s.searchMatchIds.length);
	const searchCurrentIndex = useRoadmapStore((s) => s.searchCurrentIndex);
	const setSearchQuery = useRoadmapStore((s) => s.setSearchQuery);
	const stepSearchMatch = useRoadmapStore((s) => s.stepSearchMatch);
	const clearSearch = useRoadmapStore((s) => s.clearSearch);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const focusSearch = () => {
			const el = inputRef.current;
			if (el) {
				el.focus();
				el.select();
			}
		};
		window.addEventListener("roadraven:focus-search", focusSearch);
		return () =>
			window.removeEventListener("roadraven:focus-search", focusSearch);
	}, []);

	const matchLabel =
		matchCount > 0 ? `${searchCurrentIndex + 1}/${matchCount}` : "0/0";

	return (
		<search className="relative flex items-center">
			<input
				ref={inputRef}
				className="w-[220px] h-[30px] bg-rv-bg-input border border-rv-border rounded-lg px-3 pr-14 text-[12px] text-rv-text-primary placeholder:text-rv-text-tertiary outline-none focus:border-rv-border-focus"
				type="text"
				placeholder="Search nodes..."
				aria-label="Search nodes"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				onKeyDown={(e) => handleSearchKeyDown(e, stepSearchMatch, clearSearch)}
			/>
			{searchQuery ? (
				<span
					className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-rv-text-tertiary pointer-events-none"
					role="status"
					aria-label={`${matchCount} matches`}
				>
					{matchLabel}
				</span>
			) : (
				<kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] bg-rv-bg-elevated rounded-[3px] px-1.5 py-0.5 text-rv-text-tertiary pointer-events-none">
					Ctrl+F
				</kbd>
			)}
		</search>
	);
}

function ToggleGroup({
	label,
	options,
	active,
	onChange,
}: {
	label: string;
	options: { value: string; label: string }[];
	active: string;
	onChange?: (value: string) => void;
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
					aria-pressed={active === opt.value}
					onClick={() => onChange?.(opt.value)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
