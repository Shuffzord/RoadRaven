import { useEffect } from "react";
import type { AppSettings } from "../../../../../shared/types";
import { electroview } from "../rpc";
import { useFileViewStore } from "../store/fileViewStore";
import { useRoadmapStore } from "../store/roadmapStore";

const SAVE_DEBOUNCE_MS = 300;

/**
 * v0.8.4 Phase 2 — the ONLY reader/writer of `fileSettings[path]`. Restores
 * the per-file layout orientation (RC3: TopBar.tsx wrote it but nothing ever
 * read it back) and the layout knobs on open, then persists both together
 * whenever either changes, debounced — so a layout toggle and a knob drag
 * can never clobber each other's write (settings.ts now merges per path).
 *
 * Untitled documents (no path yet, or `isUntitled`) restore nothing and save
 * nothing — there is no path to key the settings on.
 */
export function useFileViewSettings(): void {
	const filePath = useRoadmapStore((s) => s.filePath);
	const isUntitled = useRoadmapStore((s) => s.isUntitled);

	useEffect(() => {
		if (!filePath || isUntitled) return;
		const path = filePath;

		// Guards the write-back subscriptions below against the setLayout/
		// hydrate calls the load below performs on itself. A ref, not a timer:
		// the load is one async round-trip of unknown duration.
		let hydrated = false;
		let saveTimer: ReturnType<typeof setTimeout> | null = null;

		const scheduleSave = (): void => {
			if (!hydrated) return;
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				const layout = useRoadmapStore.getState().layoutOrientation;
				const { layoutKnobs, customLayout, nodeOffsets } =
					useFileViewStore.getState();
				electroview?.rpc?.request
					.saveSettings({
						settings: {
							fileSettings: {
								[path]: { layout, layoutKnobs, customLayout, nodeOffsets },
							},
						},
					})
					.catch(() => {
						// Settings unavailable — the in-memory state is still correct.
					});
			}, SAVE_DEBOUNCE_MS);
		};

		electroview?.rpc?.request
			.loadSettings({})
			.then(({ settings }: { settings: AppSettings }) => {
				const forFile = settings.fileSettings?.[path];
				if (forFile?.layout === "TB" || forFile?.layout === "LR") {
					useRoadmapStore.getState().setLayout(forFile.layout);
				}
				// No stored knobs for this path (Save As, the first save of an
				// untitled document, or any brand-new file) is not "reset": the
				// current in-memory knobs ARE the user's current view and must
				// survive untouched, exactly like orientation above.
				if (forFile?.layoutKnobs) {
					useFileViewStore.getState().hydrate(forFile.layoutKnobs);
				}
				// v0.8.4 Phase 3: same rule — only a stored key is applied.
				if (forFile) {
					useFileViewStore.getState().hydrateCustomLayout(forFile);
				}
				hydrated = true;
			})
			.catch(() => {
				// Settings unavailable — keep the defaults, and still allow
				// subsequent edits in this session to be saved.
				hydrated = true;
			});

		const unsubRoadmap = useRoadmapStore.subscribe((state, prev) => {
			if (state.layoutOrientation !== prev.layoutOrientation) scheduleSave();
		});
		const unsubFileView = useFileViewStore.subscribe((state, prev) => {
			if (
				state.layoutKnobs !== prev.layoutKnobs ||
				state.customLayout !== prev.customLayout ||
				state.nodeOffsets !== prev.nodeOffsets
			) {
				scheduleSave();
			}
		});

		return () => {
			if (saveTimer) clearTimeout(saveTimer);
			unsubRoadmap();
			unsubFileView();
		};
	}, [filePath, isUntitled]);
}
