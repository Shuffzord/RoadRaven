import { useState } from "react";
import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

/**
 * Plan 03-04b mid-plan UAT surface. Exposes the autosave state machine so a
 * verifier can click through every transition without having to trigger real
 * filesystem failures.
 *
 *   - Trigger autosave now: dispatches roadraven:trigger-save (useAutosave flushes)
 *   - Force failure (N): climbs 1 -> 2 -> 3 -> modal via setSaveState
 *   - Reset to "saved": clears state + counter
 *   - Pause / Unpause autosave: toggles externalEditPending via setExternalEdit
 *
 * Dev-only: mounted by DevHarness, which itself is gated by
 * import.meta.env.DEV at the App.tsx mount site.
 */
export function AutosavePanel() {
	const saveState = useRoadmapStore((s) => s.saveState);
	const failureCount = useRoadmapStore((s) => s.failureCount);
	const lastSaveError = useRoadmapStore((s) => s.lastSaveError);
	const lastSavedDataKey = useRoadmapStore((s) => s.lastSavedDataKey);
	const dataKey = useRoadmapStore((s) => s.dataKey);
	const triggerSave = useRoadmapStore((s) => s.triggerSave);
	const setSaveState = useRoadmapStore((s) => s.setSaveState);
	const setExternalEdit = useRoadmapStore((s) => s.setExternalEdit);
	const autosavePaused = useRoadmapStore((s) => s.autosavePaused);
	const [forceFailureCount, setForceFailureCount] = useState(0);

	const forceFailure = () => {
		const next = forceFailureCount + 1;
		setForceFailureCount(next);
		if (next === 1) {
			setSaveState("error-retrying", "Forced failure #1 (DevHarness)");
		} else if (next === 2) {
			// setSaveState for error-manual does not bump failureCount by design;
			// we write both fields explicitly so the panel's counter matches.
			useRoadmapStore.setState({
				saveState: "error-manual",
				failureCount: next,
				lastSaveError: {
					message: "Forced failure #2 (DevHarness)",
					attemptedAt: Date.now(),
				},
			});
		} else {
			useRoadmapStore.setState({
				saveState: "error-modal",
				failureCount: next,
				lastSaveError: {
					message: "Forced failure #3 (DevHarness)",
					attemptedAt: Date.now(),
				},
			});
		}
	};

	const resetState = () => {
		setSaveState("saved");
		setForceFailureCount(0);
	};

	const togglePause = () => {
		setExternalEdit(autosavePaused ? null : "/tmp/external.json");
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<strong>Plan 04b — Autosave</strong>
			<div style={{ fontSize: 10, opacity: 0.8 }}>
				saveState: <code>{saveState}</code>
				{autosavePaused ? " (paused)" : ""}
				<br />
				failureCount: {failureCount}
				<br />
				dataKey: {dataKey} / lastSaved: {lastSavedDataKey}
				<br />
				lastSaveError: {lastSaveError?.message ?? "(none)"}
			</div>
			<button type="button" onClick={() => triggerSave()}>
				Trigger autosave now
			</button>
			<button type="button" onClick={forceFailure}>
				Force failure (N={forceFailureCount + 1})
			</button>
			<button type="button" onClick={resetState}>
				Reset to "saved"
			</button>
			<button type="button" onClick={togglePause}>
				{autosavePaused ? "Unpause" : "Pause autosave"}
			</button>
		</div>
	);
}
