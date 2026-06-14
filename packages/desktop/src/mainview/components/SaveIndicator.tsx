import { useEffect, useRef, useState } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

// On fast disks the autosave write completes in <50ms, so the saveState
// flickers from "saving" → "saved" too quickly for the user to perceive
// any feedback that a save happened. Hold the displayed "saving" state for
// a minimum of 800ms so the indicator is visible. Error states transition
// instantly — only the saving→saved transition is held.
const MIN_SAVING_DISPLAY_MS = 800;

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

	// Hold "saving" on screen for MIN_SAVING_DISPLAY_MS even if the underlying
	// store flips back to "saved" sooner. Error states bypass the hold.
	const [displayState, setDisplayState] = useState(saveState);
	const savingShownAtRef = useRef<number | null>(null);
	useEffect(() => {
		if (saveState === "saving") {
			setDisplayState("saving");
			savingShownAtRef.current = Date.now();
			return;
		}
		if (saveState !== "saved" || savingShownAtRef.current === null) {
			setDisplayState(saveState);
			return;
		}
		const elapsed = Date.now() - savingShownAtRef.current;
		const remaining = MIN_SAVING_DISPLAY_MS - elapsed;
		if (remaining <= 0) {
			setDisplayState(saveState);
			savingShownAtRef.current = null;
			return;
		}
		const timer = setTimeout(() => {
			setDisplayState(saveState);
			savingShownAtRef.current = null;
		}, remaining);
		return () => clearTimeout(timer);
	}, [saveState]);

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

	if (displayState === "saved") {
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
	if (displayState === "saving") {
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
	if (displayState === "error-retrying") {
		return (
			<div className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked">
				<ErrorIcon />
				<span>Error saving — retrying…</span>
			</div>
		);
	}
	if (displayState === "error-manual") {
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
