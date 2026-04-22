import { useRoadmapStore } from "../store/roadmapStore";

function ErrorIcon() {
	return (
		<svg
			width={10}
			height={10}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			aria-hidden="true"
		>
			<title>Save error</title>
			<line x1="12" y1="9" x2="12" y2="13" />
			<circle cx="12" cy="17" r="1.5" fill="currentColor" />
		</svg>
	);
}

/**
 * SaveIndicator (EDIT-15 / D-15).
 *
 * Five states reflect the store's saveState machine:
 *   - "saved"           → green dot + "Saved"
 *   - "saving"          → pulsing dot + "Saving…"
 *   - "error-retrying"  → red ! + "Error saving — retrying…" (non-interactive)
 *   - "error-manual"    → red ! + "Error saving — click to retry" (button)
 *   - "error-modal"     → red ! + "Error saving" (SaveFailureModal covers UI)
 */
export function SaveIndicator() {
	const saveState = useRoadmapStore((s) => s.saveState);
	const filePath = useRoadmapStore((s) => s.filePath);
	const triggerSave = useRoadmapStore((s) => s.triggerSave);

	// No real disk path yet (sample load, HMR fallback, File>New). Surface this
	// explicitly instead of letting autosave silently no-op or escalate to error.
	if (!filePath) {
		return (
			<div className="flex items-center gap-1.5 text-[11px] text-rv-text-tertiary">
				<span
					aria-hidden="true"
					className="w-[7px] h-[7px] rounded-full border border-rv-text-tertiary"
				/>
				<span>Untitled — Save As to enable autosave</span>
			</div>
		);
	}

	if (saveState === "saved") {
		return (
			<div className="flex items-center gap-1.5 text-[11px] text-rv-text-tertiary">
				<span
					aria-hidden="true"
					className="w-[7px] h-[7px] rounded-full bg-rv-status-completed"
				/>
				<span>Saved</span>
			</div>
		);
	}
	if (saveState === "saving") {
		return (
			<div className="flex items-center gap-1.5 text-[11px] text-rv-text-secondary">
				<span
					aria-hidden="true"
					className="w-[7px] h-[7px] rounded-full bg-rv-text-secondary motion-safe:animate-pulse"
				/>
				<span>Saving…</span>
			</div>
		);
	}
	if (saveState === "error-retrying") {
		return (
			<div className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked">
				<ErrorIcon />
				<span>Error saving — retrying…</span>
			</div>
		);
	}
	if (saveState === "error-manual") {
		return (
			<button
				type="button"
				onClick={() => triggerSave()}
				aria-label="Save failed. Click to retry saving."
				className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked hover:underline cursor-pointer bg-transparent border-0 p-0"
			>
				<ErrorIcon />
				<span>Error saving — click to retry</span>
			</button>
		);
	}
	// error-modal — indicator shows "Error saving" while modal covers the UI
	return (
		<div className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked">
			<ErrorIcon />
			<span>Error saving</span>
		</div>
	);
}
