import { useEffect } from "react";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import type { RoadmapRPCType } from "../../../../../shared/types";
import { serializeFileOperation } from "../fileOperationQueue";
import { basename, dirname } from "../lib/filePath";
// Cycle useFileActions → rpc → rpcHandlers → useFileActions: rpc reaches back
// here only via dynamic import() at call time, so there is no runtime init
// cycle. Suppression anchored to this static edge (the only one fallow can match).
// fallow-ignore-next-line circular-dependency
import { electroview } from "../rpc";
import { loadSampleData } from "../samples";
import { hasUnsavedEdits, useRoadmapStore } from "../store/roadmapStore";
import { useToastStore } from "../store/toastStore";

type Rpc = NonNullable<NonNullable<typeof electroview>["rpc"]>;
type LoadFileResponse =
	RoadmapRPCType["bun"]["requests"]["loadFile"]["response"];
type SchemaError = { path: string; message: string; code: string };
type DiscardChoice = "save" | "discard" | "cancel";

/** Result of one guarded load — the agent's openFile maps these to tool codes. */
export type OpenFileOutcome =
	| { ok: true; filePath: string }
	| { ok: false; reason: "unsaved_edits" }
	| { ok: false; reason: "read_error"; errors: SchemaError[] }
	| {
			ok: false;
			reason: "conflict";
			currentRevision: number;
			backendBindingRestored: boolean;
	  };

/** Upper bound on waiting for an autosave flush before a guard gives up. */
export const FLUSH_TIMEOUT_MS = 5000;

// WR-01 (Wave 3 review): module-level dedupe for Save As. A fast double-click
// on SaveFailureModal's "Save As…" button (or Ctrl+Shift+S while the native
// dialog is open) would otherwise stack two native save dialogs and race two
// atomic writes to the chosen path. Sharing this promise means the second
// caller awaits the first instead of opening a second dialog.
let inFlightSaveAs: Promise<{ filePath: string | null }> | null = null;

function pushFileToast(type: "file_info" | "file_error", detail: string) {
	useToastStore.getState().pushToast({ type, source: "file", detail });
}

/** Publish a successful loadFile response into the store; returns the bound path. */
function applyLoadedFile(
	response: LoadFileResponse & { data: RoadmapSchema },
	path: string,
): string {
	const store = useRoadmapStore.getState();
	const loadedPath = response.filePath ?? path;
	store.loadSchema(response.data, loadedPath, response.linkedFiles ?? []);
	store.applyEventBatch(response.sidecarUpdates ?? []);
	return loadedPath;
}

interface LoadSnapshot {
	agentRevision: number;
	dataKey: string;
	statusTick: number;
	filePath: string | null;
	hadSchema: boolean;
}

function snapshotOf(
	state: ReturnType<typeof useRoadmapStore.getState>,
): LoadSnapshot {
	return {
		agentRevision: state.agentRevision,
		dataKey: state.dataKey,
		statusTick: state.statusTick,
		filePath: state.filePath,
		hadSchema: state.schema !== null,
	};
}

/**
 * Bun bound itself to the requested file while the renderer moved on; point
 * it back at the file the renderer still shows, or unbind it entirely so the
 * explicit-path autosave cannot write the old document to the new target.
 */
async function restoreBunBinding(
	snapshot: LoadSnapshot,
	hasSchema: boolean,
): Promise<boolean> {
	const rpc = electroview?.rpc;
	if (!rpc) return false;
	let restored = false;
	try {
		if (snapshot.filePath) {
			const rollback = await rpc.request.loadFile({ path: snapshot.filePath });
			restored = rollback.data !== null;
		} else if (snapshot.hadSchema || hasSchema) {
			await rpc.request.newFile({});
			restored = true;
		}
	} catch {
		// Fall through to the safe unbound state below.
	}
	if (!restored) {
		try {
			await rpc.request.newFile({});
		} catch {
			// Explicit-path autosave still prevents writing to the target.
		}
	}
	return restored;
}

/** The renderer moved on (edit, agent write, status event) while Bun was loading. */
function isConflicted(
	snapshot: LoadSnapshot,
	store: ReturnType<typeof useRoadmapStore.getState>,
): boolean {
	return (
		store.agentRevision !== snapshot.agentRevision ||
		store.dataKey !== snapshot.dataKey ||
		store.statusTick !== snapshot.statusTick
	);
}

function publishReadError(errors: SchemaError[] = []): OpenFileOutcome {
	useRoadmapStore.getState().setSchemaErrors(errors);
	return { ok: false, reason: "read_error", errors };
}

/**
 * Load `path` through Bun and publish it, unless the renderer changed
 * underneath the RPC. Runs the unsaved-edits revalidation inside the queue;
 * the user-facing guard (ensureSafeToDiscard) runs BEFORE it, outside the
 * queue, because flushing goes through the same queue.
 */
export async function requestAndApply(
	path: string,
	allowDirtySnapshot = false,
): Promise<OpenFileOutcome> {
	// Load, conflict detection, and rollback are one atomic queued operation.
	return serializeFileOperation(async () => {
		const before = useRoadmapStore.getState();
		if (!allowDirtySnapshot && before.schema && hasUnsavedEdits(before)) {
			return { ok: false, reason: "unsaved_edits" };
		}
		const snapshot = snapshotOf(before);
		const response = await electroview?.rpc?.request.loadFile({ path });
		if (!response?.data) return publishReadError(response?.errors);
		const store = useRoadmapStore.getState();
		if (isConflicted(snapshot, store)) {
			return {
				ok: false,
				reason: "conflict",
				currentRevision: store.agentRevision,
				backendBindingRestored: await restoreBunBinding(
					snapshot,
					store.schema !== null,
				),
			};
		}
		const filePath = applyLoadedFile(
			{ ...response, data: response.data },
			path,
		);
		useRoadmapStore.getState().setSchemaErrors(response.errors ?? []);
		return { ok: true, filePath };
	});
}

/** Resolves with the outcome, or null when the RPC itself threw. */
async function loadAndApply(path: string): Promise<OpenFileOutcome | null> {
	const fail = () =>
		useRoadmapStore.getState().setSchemaErrors([
			{
				path: "",
				message: `Failed to load file: ${path}`,
				code: "rpc_error",
			},
		]);
	try {
		const outcome = await requestAndApply(path);
		// A read error already published Bun's own error list.
		if (!outcome.ok && outcome.reason !== "read_error") fail();
		return outcome;
	} catch {
		fail();
		return null;
	}
}

/** Bun could not read the file at all (missing, unreadable) — not a parse error. */
function isUnreadable(outcome: OpenFileOutcome | null): boolean {
	return (
		outcome !== null &&
		!outcome.ok &&
		outcome.reason === "read_error" &&
		outcome.errors.some((e) => e.code === "file_read_error")
	);
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
				applyLoadedFile({ ...response, data: response.data }, targetPath);
			}
			useRoadmapStore.getState().setSchemaErrors(response.errors ?? []);
		});
	} catch {
		useRoadmapStore
			.getState()
			.setExternalEdit(payload.mainPath ?? payload.path);
	}
}

// ---------------------------------------------------------------------------
// v0.8.2 A4 — renderer-side edits to `settings.recentFiles`
//
// Bun appends on every successful load; removing is a renderer decision (the
// sidebar's row menu, or a recent entry whose file is gone). Each write
// announces itself so every mounted `useRecentFiles` refetches. Lives here
// rather than in a lib module because anything that imports `rpc` and is
// imported by this file closes a new import cycle through rpcHandlers.
// ---------------------------------------------------------------------------

export const RECENT_FILES_CHANGED_EVENT = "roadraven:recent-files-changed";

async function writeRecentFiles(recentFiles: string[]): Promise<void> {
	await electroview?.rpc?.request.saveSettings({ settings: { recentFiles } });
	window.dispatchEvent(new Event(RECENT_FILES_CHANGED_EVENT));
}

export async function removeRecentFile(path: string): Promise<void> {
	const result = await electroview?.rpc?.request.loadSettings({});
	const current = result?.settings.recentFiles ?? [];
	await writeRecentFiles(current.filter((p) => p !== path));
}

export function clearRecentFiles(): Promise<void> {
	return writeRecentFiles([]);
}

// ---------------------------------------------------------------------------
// v0.8.2 A1 — unsaved-edits guard
// ---------------------------------------------------------------------------

/**
 * Flush pending edits of a file-backed document through the autosave path
 * and wait for the store to report them saved. False on a save error, on a
 * paused autosave (external edit pending) or after FLUSH_TIMEOUT_MS.
 * Shared by the UI guard and the agent's openFile (D-12).
 */
export function flushUnsavedEdits(): Promise<boolean> {
	const store = useRoadmapStore.getState();
	if (store.autosavePaused) return Promise.resolve(false);
	store.triggerSave();
	return new Promise((resolve) => {
		const isSavedAndClean = (s: typeof store) =>
			s.saveState === "saved" && !hasUnsavedEdits(s);
		const settle = (ok: boolean) => {
			clearTimeout(timer);
			unsub();
			resolve(ok);
		};
		const timer = setTimeout(() => settle(false), FLUSH_TIMEOUT_MS);
		// An error counts only once this flush has actually started saving —
		// a stale error state from before the retry must not end the wait.
		let sawSaving = false;
		const unsub = useRoadmapStore.subscribe((s) => {
			if (s.saveState === "saving") {
				sawSaving = true;
			} else if (isSavedAndClean(s)) {
				settle(true);
			} else if (sawSaving && s.saveState.startsWith("error")) {
				settle(false);
			}
		});
		// triggerSave may have completed synchronously (tests stub it so).
		if (isSavedAndClean(useRoadmapStore.getState())) settle(true);
	});
}

async function promptDiscard(): Promise<boolean> {
	if (useRoadmapStore.getState().pendingDiscard) return false;
	const choice = await new Promise<DiscardChoice>((resolve) => {
		useRoadmapStore.setState({ pendingDiscard: { resolve } });
	});
	useRoadmapStore.setState({ pendingDiscard: null });
	if (choice === "cancel") return false;
	if (choice === "discard") return true;
	return (await saveAs()).filePath !== null;
}

/**
 * May the current document be replaced or closed? Runs before New, Open,
 * Open Recent, Close File, samples and the window close guard.
 *
 *   - no schema, or nothing unsaved      → true
 *   - file-backed with edits             → flush and wait (flushUnsavedEdits)
 *   - untitled with edits                → DiscardChangesDialog; "Save As…"
 *                                          counts only if a path came back
 */
export async function ensureSafeToDiscard(): Promise<boolean> {
	const state = useRoadmapStore.getState();
	if (!state.schema || !hasUnsavedEdits(state)) return true;
	if (state.filePath && !state.isUntitled) return flushUnsavedEdits();
	return promptDiscard();
}

// ---------------------------------------------------------------------------
// File actions — module-level so the fileCommands registry, the keyboard
// router, the agent dispatcher and the hook all call the same function.
// ---------------------------------------------------------------------------

/** Seed the native dialog where the current file lives; untitled → roadmap.json. */
function saveAsDefaults(filePath: string | null) {
	if (!filePath) return { defaultPath: undefined, defaultName: "roadmap.json" };
	return { defaultPath: dirname(filePath), defaultName: basename(filePath) };
}

/** A6: Save As wrote one standalone file; the companions were left alone. */
function warnLinkedFilesNotCopied(paths: string[] = []): void {
	const merged = paths.length;
	if (merged === 0) return;
	const noun = merged === 1 ? "file" : "files";
	pushFileToast(
		"file_info",
		`Saved as a single file — content from ${merged} linked ${noun} was merged in; the originals were not modified.`,
	);
}

async function saveAsSerialized(
	rpc: Rpc,
): Promise<{ filePath: string | null }> {
	const state = useRoadmapStore.getState();
	if (!state.schema) return { filePath: null };
	const savingDataKey = state.dataKey;
	const savingStatusTick = state.statusTick;
	const result = await rpc.request.saveFileAs({
		schema: state.schema,
		...saveAsDefaults(state.filePath),
	});
	if (!result?.filePath) return result;
	useRoadmapStore.setState({
		filePath: result.filePath,
		isUntitled: false,
		saveState: "saved",
		failureCount: 0,
		lastSaveError: null,
		lastSavedDataKey: savingDataKey,
		lastSavedStatusTick: savingStatusTick,
		// A6: Save As writes one standalone root file.
		linkedFiles: [],
	});
	warnLinkedFilesNotCopied(result.linkedFilesNotCopied);
	return result;
}

/** Native Save As. Resolves with the chosen path, or null when cancelled. */
export function saveAs(): Promise<{ filePath: string | null }> {
	const rpc = electroview?.rpc;
	if (!rpc) return Promise.resolve({ filePath: null });
	if (inFlightSaveAs) return inFlightSaveAs;
	const run = serializeFileOperation(() => saveAsSerialized(rpc)).finally(
		() => {
			inFlightSaveAs = null;
		},
	);
	inFlightSaveAs = run;
	return run;
}

/** Flush now: autosave path for a file-backed document, Save As otherwise. */
export async function save(): Promise<void> {
	const state = useRoadmapStore.getState();
	if (!state.schema) return;
	if (state.isUntitled || !state.filePath) {
		await saveAs();
		return;
	}
	state.triggerSave();
}

/** A2: back to the Welcome screen — guard, stop Bun's watchers, reset the store. */
export async function closeFile(): Promise<void> {
	if (!useRoadmapStore.getState().schema) return;
	if (!(await ensureSafeToDiscard())) return;
	await serializeFileOperation(async () => {
		try {
			await electroview?.rpc?.request.closeFile({});
		} catch {
			// The renderer still leaves the document; a stray watcher push for
			// the old path is ignored once filePath is null.
		}
		useRoadmapStore.getState().closeSchema();
	});
}

export async function revealInFolder(): Promise<void> {
	const { filePath } = useRoadmapStore.getState();
	if (!filePath) return;
	const result = await electroview?.rpc?.request.revealInFolder({
		path: filePath,
	});
	if (!result?.ok) pushFileToast("file_error", "File not found on disk.");
}

export async function copyPath(): Promise<void> {
	const { filePath } = useRoadmapStore.getState();
	if (!filePath) return;
	await navigator.clipboard.writeText(filePath);
}

/** A5: a bundled sample is explicitly untitled — same Save As path as New. */
async function loadSampleAsUntitled(sample: unknown): Promise<void> {
	const { RoadmapSchemaSchema } = await import(
		"../../../../../packages/core/src/schema"
	);
	const result = RoadmapSchemaSchema.safeParse(sample);
	if (!result.success) return;
	useRoadmapStore.getState().loadSchema(result.data, null);
	useRoadmapStore.setState({ isUntitled: true });
}

export async function openFile(): Promise<void> {
	if (!(await ensureSafeToDiscard())) return;
	if (electroview) {
		const path = await electroview.rpc?.request.openFilePicker({});
		if (!path) return;
		await loadAndApply(path);
	} else {
		await serializeFileOperation(async () => {
			// HMR / browser-only fallback: no file picker, load the intro sample.
			const sample = (
				await import("../../../../../samples/getting-started.json")
			).default;
			await loadSampleAsUntitled(sample);
		});
	}
}

export async function openRecent(path: string): Promise<void> {
	if (!electroview) return;
	if (!(await ensureSafeToDiscard())) return;
	const outcome = await loadAndApply(path);
	// A4: a recent entry whose file is gone leaves the list instead of lingering.
	if (isUnreadable(outcome)) {
		pushFileToast("file_error", "File not found — removed from Recent Files");
		await removeRecentFile(path);
	}
}

export async function openSample(name: string): Promise<void> {
	if (!(await ensureSafeToDiscard())) return;
	try {
		await serializeFileOperation(async () => {
			const sampleData = await loadSampleData(name);
			if (sampleData === null) return;
			await loadSampleAsUntitled(sampleData);
		});
	} catch {
		// Sample load failed silently
	}
}

// Plan 03-04c (EDIT-17): WelcomeScreen → File > New entry point.
// In Electrobun mode we route through Bun's newFile RPC so the Bun-side
// cache + ownership map are reset alongside the in-memory schema. In dev
// HMR (no electroview) the store-only path is sufficient. No save is
// triggered here (v0.8.2 F7): the untitled document asks for a home on its
// first real edit, via useAutosave.
export async function newRoadmap(): Promise<void> {
	if (!(await ensureSafeToDiscard())) return;
	await serializeFileOperation(async () => {
		if (electroview?.rpc) {
			try {
				const result = await electroview.rpc.request.newFile({});
				if (result?.data) {
					useRoadmapStore.getState().loadSchema(result.data, null);
					useRoadmapStore.setState({ isUntitled: true });
					return;
				}
			} catch {
				// Fall through to the store-only path below
			}
		}
		useRoadmapStore.getState().newUntitledSchema();
	});
}

export function useFileActions() {
	// Plan 03-04c CustomEvent bridges:
	//
	//   - roadraven:reload-file       (from Plan 04b store.resolveExternalEdit('reload')
	//                                  + Plan 04c ExternalEditToast Reload button)
	//   - roadraven:request-save-as   (from Plan 04b SaveFailureModal Save As… button)
	//
	// Both delegate to the module-level actions above.
	useEffect(() => {
		const reloadHandler = async (e: Event): Promise<void> => {
			const detail = (e as CustomEvent<{ path: string }>).detail;
			if (!detail?.path) return;
			if (!electroview?.rpc) return;
			await requestAndApply(detail.path, true);
		};
		const saveAsHandler = async (): Promise<void> => {
			await saveAs();
		};
		window.addEventListener("roadraven:reload-file", reloadHandler);
		window.addEventListener("roadraven:request-save-as", saveAsHandler);
		return () => {
			window.removeEventListener("roadraven:reload-file", reloadHandler);
			window.removeEventListener("roadraven:request-save-as", saveAsHandler);
		};
	}, []);

	return {
		openFile,
		openRecent,
		openSample,
		newRoadmap,
		save,
		saveAs,
		closeFile,
		revealInFolder,
		copyPath,
	};
}
