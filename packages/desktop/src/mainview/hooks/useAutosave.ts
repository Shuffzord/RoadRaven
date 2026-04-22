import { useEffect, useRef } from "react";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";

export const STRUCTURAL_DEBOUNCE_MS = 2000;
export const NOTES_DEBOUNCE_MS = 1000;
export const PERIODIC_MS = 30_000;
export const RETRY_DELAY_MS = 5000;

/**
 * Core autosave engine (EDIT-13).
 *
 * - structural mutations (dataKey bump): flush after STRUCTURAL_DEBOUNCE_MS (2s)
 * - in-place mutations (statusTick bump): flush after NOTES_DEBOUNCE_MS (1s)
 * - periodic sweep every PERIODIC_MS (30s) regardless of mutations
 *
 * Failure escalates: 1st → error-retrying + 5s auto-retry; 2nd → error-manual
 * (manual retry only); 3rd → error-modal.
 *
 * Warning 8: on success, lastSavedDataKey + lastSavedStatusTick are snapshotted
 * to the values captured when the save was issued — not at resolution time.
 */
export function useAutosave(): void {
	const structRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const notesRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastDataKey = useRef<string | null>(null);
	const lastStatusTick = useRef<number | null>(null);

	useEffect(() => {
		// Seed the per-render tracking refs from the current store snapshot so
		// the first store.subscribe fire after a fresh mount doesn't mistake
		// the existing keys for a new mutation.
		const initial = useRoadmapStore.getState();
		lastDataKey.current = initial.dataKey;
		lastStatusTick.current = initial.statusTick;

		periodicRef.current = setInterval(() => {
			void flushNow();
		}, PERIODIC_MS);

		const triggerHandler = (): void => {
			void flushNow();
		};
		window.addEventListener("roadraven:trigger-save", triggerHandler);

		const unsub = useRoadmapStore.subscribe((state) => {
			if (state.autosavePaused) return;
			if (state.dataKey !== lastDataKey.current) {
				lastDataKey.current = state.dataKey;
				if (structRef.current) clearTimeout(structRef.current);
				structRef.current = setTimeout(() => {
					void flushNow();
				}, STRUCTURAL_DEBOUNCE_MS);
			} else if (state.statusTick !== lastStatusTick.current) {
				lastStatusTick.current = state.statusTick;
				if (notesRef.current) clearTimeout(notesRef.current);
				notesRef.current = setTimeout(() => {
					void flushNow();
				}, NOTES_DEBOUNCE_MS);
			}
		});

		return () => {
			if (periodicRef.current) clearInterval(periodicRef.current);
			if (structRef.current) clearTimeout(structRef.current);
			if (notesRef.current) clearTimeout(notesRef.current);
			window.removeEventListener("roadraven:trigger-save", triggerHandler);
			unsub();
		};
	}, []);
}

async function flushNow(): Promise<void> {
	const state = useRoadmapStore.getState();
	if (state.autosavePaused) return;
	if (!state.schema) return;
	if (state.saveState === "saving") return;
	if (!electroview?.rpc) return;

	// Warning 8: capture the keys we are about to persist NOW — on success we
	// record these as lastSavedDataKey/lastSavedStatusTick so a concurrent
	// mutation that lands mid-save still marks the doc as dirty.
	const savingDataKey = state.dataKey;
	const savingStatusTick = state.statusTick;

	// EDIT-17 — File > New prompt path. When the schema has no disk path yet
	// (isUntitled, or HMR-loaded sample), the first autosave fire pops
	// Utils.saveFileDialog via the saveFileAs RPC. User cancels → stay
	// "saved" in-memory; next mutation will re-prompt after the debounce.
	if (state.isUntitled || !state.filePath) {
		try {
			const result = await electroview.rpc.request.saveFileAs({
				schema: state.schema,
			});
			if (result?.filePath) {
				useRoadmapStore.setState({
					filePath: result.filePath,
					isUntitled: false,
					saveState: "saved",
					failureCount: 0,
					lastSaveError: null,
					lastSavedDataKey: savingDataKey,
					lastSavedStatusTick: savingStatusTick,
				});
			}
			return;
		} catch (err) {
			handleFailure(err instanceof Error ? err.message : String(err));
			return;
		}
	}

	state.setSaveState("saving");
	try {
		const result = await electroview.rpc.request.saveFile({
			schema: state.schema,
		});
		if ("ok" in result && result.ok) {
			useRoadmapStore.setState({
				saveState: "saved",
				failureCount: 0,
				lastSaveError: null,
				lastSavedDataKey: savingDataKey,
				lastSavedStatusTick: savingStatusTick,
			});
		} else {
			const msg =
				"error" in result && result.error ? result.error : "Unknown save error";
			handleFailure(msg);
		}
	} catch (err) {
		handleFailure(err instanceof Error ? err.message : String(err));
	}
}

function handleFailure(msg: string): void {
	const state = useRoadmapStore.getState();
	const nextFailures = state.failureCount + 1;
	if (nextFailures === 1) {
		// setSaveState("error-retrying") increments failureCount → 1
		state.setSaveState("error-retrying", msg);
		setTimeout(() => {
			void flushNow();
		}, RETRY_DELAY_MS);
	} else if (nextFailures === 2) {
		// setSaveState("error-manual") does NOT increment — write both fields
		useRoadmapStore.setState({
			saveState: "error-manual",
			failureCount: nextFailures,
			lastSaveError: { message: msg, attemptedAt: Date.now() },
		});
	} else {
		useRoadmapStore.setState({
			saveState: "error-modal",
			failureCount: nextFailures,
			lastSaveError: { message: msg, attemptedAt: Date.now() },
		});
	}
}
