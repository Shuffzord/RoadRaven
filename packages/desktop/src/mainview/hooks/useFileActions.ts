import { useCallback, useEffect } from "react";
import { serializeFileOperation } from "../fileOperationQueue";
// Cycle useFileActions → rpc → rpcHandlers → useFileActions: rpc reaches back
// here only via dynamic import() at call time, so there is no runtime init
// cycle. Suppression anchored to this static edge (the only one fallow can match).
// fallow-ignore-next-line circular-dependency
import { electroview } from "../rpc";
import { loadSampleData } from "../samples";
import { hasUnsavedEdits, useRoadmapStore } from "../store/roadmapStore";

// WR-01 (Wave 3 review): module-level dedupe for the roadraven:request-save-as
// CustomEvent handler. A fast double-click on SaveFailureModal's "Save As…"
// button (or two CustomEvent re-dispatches in flight) would otherwise stack two
// native save dialogs and race two atomic writes to the chosen path. Sharing
// this promise across renders / Canvas+App duplicate registrations means the
// second caller awaits the first instead of opening a second dialog.
let inFlightSaveAs: Promise<{ filePath: string | null }> | null = null;

async function requestAndApply(
	path: string,
	allowDirtySnapshot = false,
): Promise<void> {
	// Load, conflict detection, and rollback are one atomic queued operation.
	// fallow-ignore-next-line complexity
	await serializeFileOperation(async () => {
		const before = useRoadmapStore.getState();
		if (!allowDirtySnapshot && hasUnsavedEdits(before)) {
			throw new Error("Save current edits before opening another roadmap");
		}
		const snapshot = {
			agentRevision: before.agentRevision,
			dataKey: before.dataKey,
			statusTick: before.statusTick,
			filePath: before.filePath,
			hadSchema: before.schema !== null,
		};
		const response = await electroview?.rpc?.request.loadFile({ path });
		if (response?.data) {
			const store = useRoadmapStore.getState();
			const conflicted =
				store.agentRevision !== snapshot.agentRevision ||
				store.dataKey !== snapshot.dataKey ||
				store.statusTick !== snapshot.statusTick;
			if (conflicted) {
				let restored = false;
				if (electroview?.rpc) {
					try {
						if (snapshot.filePath) {
							const rollback = await electroview.rpc.request.loadFile({
								path: snapshot.filePath,
							});
							restored = rollback.data !== null;
						} else if (snapshot.hadSchema || store.schema) {
							await electroview.rpc.request.newFile({});
							restored = true;
						}
					} catch {
						// Fall through to the safe unbound state below.
					}
					if (!restored) {
						try {
							await electroview.rpc.request.newFile({});
						} catch {
							// Explicit-path autosave still prevents writing to the target.
						}
					}
				}
				throw new Error("Roadmap changed while the requested file was loading");
			}
			const loadedPath = response.filePath ?? path;
			store.loadSchema(response.data, loadedPath);
			store.applyEventBatch(response.sidecarUpdates ?? []);
		}
		useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
	});
}

async function loadAndApply(path: string): Promise<void> {
	try {
		await requestAndApply(path);
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
	mainPath?: string;
}): Promise<void> {
	try {
		// Watcher reload decisions must be revalidated inside the queue.
		// fallow-ignore-next-line complexity
		await serializeFileOperation(async () => {
			const state = useRoadmapStore.getState();
			const targetPath = payload.mainPath ?? payload.path;
			// Ignore delayed watcher messages from a file that is no longer open.
			if (state.filePath !== targetPath) return;
			const active =
				state.saveState === "saving" || state.saveState === "error-retrying";
			if (hasUnsavedEdits(state) || active || !electroview?.rpc) {
				state.setExternalEdit(targetPath);
				return;
			}
			const revision = state.agentRevision;
			const response = await electroview.rpc.request.loadFile({
				path: targetPath,
			});
			const current = useRoadmapStore.getState();
			if (current.agentRevision !== revision || hasUnsavedEdits(current)) {
				current.setExternalEdit(targetPath);
				return;
			}
			if (response.data) {
				current.loadSchema(response.data, response.filePath ?? targetPath);
				current.applyEventBatch(response.sidecarUpdates ?? []);
			}
			useRoadmapStore.getState().setSchemaErrors(response.errors ?? []);
		});
	} catch {
		useRoadmapStore
			.getState()
			.setExternalEdit(payload.mainPath ?? payload.path);
	}
}

export function useFileActions() {
	const openFile = useCallback(async () => {
		if (electroview) {
			const path = await electroview.rpc?.request.openFilePicker({});
			if (!path) return;
			await loadAndApply(path);
		} else {
			await serializeFileOperation(async () => {
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
			});
		}
	}, []);

	const openRecent = useCallback(async (path: string) => {
		if (electroview) {
			await loadAndApply(path);
		}
	}, []);

	const openSample = useCallback(async (name: string) => {
		try {
			await serializeFileOperation(async () => {
				const sampleData = await loadSampleData(name);
				if (sampleData === null) return;
				const { RoadmapSchemaSchema } = await import(
					"../../../../../packages/core/src/schema"
				);
				const result = RoadmapSchemaSchema.safeParse(sampleData);
				if (result.success) {
					// Sample loaded into memory only — autosave needs File > Save As
					// to obtain a real path before writing to disk.
					useRoadmapStore.getState().loadSchema(result.data, null);
				}
			});
		} catch {
			// Sample load failed silently
		}
	}, []);

	// Plan 03-04c (EDIT-17): WelcomeScreen → File > New entry point.
	// In Electrobun mode we route through Bun's newFile RPC so the Bun-side
	// cache + ownership map are reset alongside the in-memory schema. In dev
	// HMR (no electroview) the store-only path is sufficient.
	const newRoadmap = useCallback(async () => {
		await serializeFileOperation(async () => {
			if (electroview?.rpc) {
				try {
					const result = await electroview.rpc.request.newFile({});
					if (result?.data) {
						useRoadmapStore.getState().loadSchema(result.data, null);
						useRoadmapStore.setState({ isUntitled: true });
						window.dispatchEvent(new CustomEvent("roadraven:trigger-save"));
						return;
					}
				} catch {
					// Fall through to the store-only path below
				}
			}
			useRoadmapStore.getState().newUntitledSchema();
			window.dispatchEvent(new CustomEvent("roadraven:trigger-save"));
		});
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
			await requestAndApply(detail.path, true);
		};
		const saveAsHandler = async (): Promise<void> => {
			const rpc = electroview?.rpc;
			if (!rpc) return;
			// WR-01 (Wave 3 review): dedupe re-entrant CustomEvent dispatches.
			// If a saveFileAs RPC is already in flight (e.g. SaveFailureModal
			// double-click, Canvas+App both registered the listener), await the
			// existing promise instead of stacking a second native dialog.
			if (inFlightSaveAs) {
				await inFlightSaveAs;
				return;
			}
			inFlightSaveAs = serializeFileOperation(async () => {
				const state = useRoadmapStore.getState();
				if (!state.schema) return { filePath: null };
				const savingDataKey = state.dataKey;
				const savingStatusTick = state.statusTick;
				const result = await rpc.request.saveFileAs({
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
				return result;
			});
			try {
				await inFlightSaveAs;
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
