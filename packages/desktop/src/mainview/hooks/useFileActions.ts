import { useCallback, useEffect } from "react";
// Cycle useFileActions → rpc → rpcHandlers → useFileActions: rpc reaches back
// here only via dynamic import() at call time, so there is no runtime init
// cycle. Suppression anchored to this static edge (the only one fallow can match).
// fallow-ignore-next-line circular-dependency
import { electroview } from "../rpc";
import { hasUnsavedEdits, useRoadmapStore } from "../store/roadmapStore";

// WR-01 (Wave 3 review): module-level dedupe for the roadraven:request-save-as
// CustomEvent handler. A fast double-click on SaveFailureModal's "Save As…"
// button (or two CustomEvent re-dispatches in flight) would otherwise stack two
// native save dialogs and race two atomic writes to the chosen path. Sharing
// this promise across renders / Canvas+App duplicate registrations means the
// second caller awaits the first instead of opening a second dialog.
let inFlightSaveAs: Promise<{ filePath: string | null }> | null = null;

async function loadAndApply(path: string): Promise<void> {
	try {
		const response = await electroview?.rpc?.request.loadFile({ path });
		if (response?.data) {
			useRoadmapStore.getState().loadSchema(response.data, path);
		}
		useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
	} catch {
		useRoadmapStore.getState().setSchemaErrors([
			{
				path: "",
				message: `Failed to load file: ${path}`,
				code: "rpc_error",
			},
		]);
	}
}

/**
 * Plan 03-04c: pure decision helper for external file changes.
 *
 * Bun's file watcher fires `pushFileChanged({path})` unconditionally (Phase 2
 * behavior preserved). The webview decides — Warning 7 design D-14:
 *
 *   - dirty (or save in flight) → setExternalEdit(path); ExternalEditToast
 *     surfaces; autosave pauses until user resolves.
 *   - clean                     → auto-reload via loadFile (Phase 2 behavior).
 *
 * Exported as a module-level function so the unit test in
 * tests/unit/store/fileActions.test.ts can exercise both branches without
 * spinning up React.
 */
export async function handleExternalFileChange(payload: {
	path: string;
}): Promise<void> {
	const state = useRoadmapStore.getState();
	const dirty = hasUnsavedEdits(state);
	const active =
		state.saveState === "saving" || state.saveState === "error-retrying";
	if (dirty || active) {
		state.setExternalEdit(payload.path);
		return;
	}
	// Clean state — auto-reload (preserves Phase 2 behavior).
	// WR-02 (Wave 3 review): if rpc is unavailable, fall back to surfacing the
	// conflict UI instead of silently no-op'ing. Wrap loadFile in try/catch so a
	// rejection (e.g. file unlinked between watcher fire and read) does not
	// become an unhandled promise rejection at the rpcHandlers subscription
	// site — instead, flag the external edit so the user sees the toast.
	if (!electroview?.rpc) {
		useRoadmapStore.getState().setExternalEdit(payload.path);
		return;
	}
	try {
		const response = await electroview.rpc.request.loadFile({
			path: payload.path,
		});
		if (response?.data) {
			useRoadmapStore.getState().loadSchema(response.data, payload.path);
		}
		useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
	} catch {
		useRoadmapStore.getState().setExternalEdit(payload.path);
	}
}

export function useFileActions() {
	const openFile = useCallback(async () => {
		if (electroview) {
			const path = await electroview.rpc?.request.openFilePicker({});
			if (!path) return;
			await loadAndApply(path);
		} else {
			// Dev mode fallback
			const { RoadmapSchemaSchema } = await import(
				"../../../../../packages/core/src/schema"
			);
			const sample = (
				await import("../../../../../samples/getting-started.json")
			).default;
			const result = RoadmapSchemaSchema.safeParse(sample);
			if (result.success) {
				// HMR / browser-only fallback: no real disk path, autosave stays paused
				// until the user explicitly saves via File > Save As.
				useRoadmapStore.getState().loadSchema(result.data, null);
			}
		}
	}, []);

	const openRecent = useCallback(async (path: string) => {
		if (electroview) {
			await loadAndApply(path);
		}
	}, []);

	const openSample = useCallback(async (name: string) => {
		try {
			let sampleData: unknown;
			if (name === "hello-world") {
				sampleData = (await import("../../../../../samples/hello-world.json"))
					.default;
			} else {
				sampleData = (
					await import("../../../../../samples/getting-started.json")
				).default;
			}
			const { RoadmapSchemaSchema } = await import(
				"../../../../../packages/core/src/schema"
			);
			const result = RoadmapSchemaSchema.safeParse(sampleData);
			if (result.success) {
				// Sample loaded into memory only — autosave needs File > Save As
				// to obtain a real path before writing to disk.
				useRoadmapStore.getState().loadSchema(result.data, null);
			}
		} catch {
			// Sample load failed silently
		}
	}, []);

	// Plan 03-04c (EDIT-17): WelcomeScreen → File > New entry point.
	// In Electrobun mode we route through Bun's newFile RPC so the Bun-side
	// cache + ownership map are reset alongside the in-memory schema. In dev
	// HMR (no electroview) the store-only path is sufficient.
	const newRoadmap = useCallback(async () => {
		if (electroview?.rpc) {
			try {
				const result = await electroview.rpc.request.newFile({});
				if (result?.data) {
					useRoadmapStore.getState().loadSchema(result.data, null);
					useRoadmapStore.setState({ isUntitled: true });
					// Pop the save dialog right away so the user gets immediate
					// feedback that this is a new untitled doc that needs a
					// home on disk. Without this, the dialog only appears
					// 2s after the first edit, which is non-obvious UX.
					window.dispatchEvent(new CustomEvent("roadraven:trigger-save"));
					return;
				}
			} catch {
				// Fall through to the store-only path below
			}
		}
		useRoadmapStore.getState().newUntitledSchema();
		window.dispatchEvent(new CustomEvent("roadraven:trigger-save"));
	}, []);

	// Plan 03-04c CustomEvent bridges:
	//
	//   - roadraven:reload-file       (from Plan 04b store.resolveExternalEdit('reload')
	//                                  + Plan 04c ExternalEditToast Reload button)
	//   - roadraven:request-save-as   (from Plan 04b SaveFailureModal Save As… button)
	//
	// Both call into the new RPC handlers added in Task 1.
	useEffect(() => {
		const reloadHandler = async (e: Event): Promise<void> => {
			const detail = (e as CustomEvent<{ path: string }>).detail;
			if (!detail?.path) return;
			if (!electroview?.rpc) return;
			const response = await electroview.rpc.request.loadFile({
				path: detail.path,
			});
			if (response?.data) {
				useRoadmapStore.getState().loadSchema(response.data, detail.path);
			}
			useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
		};
		const saveAsHandler = async (): Promise<void> => {
			const schema = useRoadmapStore.getState().schema;
			if (!schema) return;
			if (!electroview?.rpc) return;
			// WR-01 (Wave 3 review): dedupe re-entrant CustomEvent dispatches.
			// If a saveFileAs RPC is already in flight (e.g. SaveFailureModal
			// double-click, Canvas+App both registered the listener), await the
			// existing promise instead of stacking a second native dialog.
			if (inFlightSaveAs) {
				await inFlightSaveAs;
				return;
			}
			inFlightSaveAs = electroview.rpc.request.saveFileAs({ schema });
			try {
				const result = await inFlightSaveAs;
				if (result?.filePath) {
					const cur = useRoadmapStore.getState();
					useRoadmapStore.setState({
						filePath: result.filePath,
						isUntitled: false,
						saveState: "saved",
						failureCount: 0,
						lastSaveError: null,
						lastSavedDataKey: cur.dataKey,
						lastSavedStatusTick: cur.statusTick,
					});
				}
			} finally {
				inFlightSaveAs = null;
			}
		};
		window.addEventListener("roadraven:reload-file", reloadHandler);
		window.addEventListener("roadraven:request-save-as", saveAsHandler);
		return () => {
			window.removeEventListener("roadraven:reload-file", reloadHandler);
			window.removeEventListener("roadraven:request-save-as", saveAsHandler);
		};
	}, []);

	return { openFile, openRecent, openSample, newRoadmap };
}
