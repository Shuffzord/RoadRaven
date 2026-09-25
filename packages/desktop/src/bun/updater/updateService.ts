// v0.8.5: the main-process update service — the single owner of UpdateState.
// Wraps the platform Updater seam; the RPC layer and the composition root only
// read and forward what this module produces.
import type { UpdateState } from "../../../../../shared/types.ts";
import { bunLogger } from "../logging";
import type { UpdateInfo, UpdateStatusEntry } from "../platform/updater";
import * as platformUpdater from "../platform/updater";

export type { UpdateState };

export type UpdaterSeam = Pick<
	typeof platformUpdater,
	| "getReleaseChannel"
	| "checkForUpdate"
	| "downloadUpdate"
	| "applyUpdate"
	| "onStatusChange"
	| "updateInfo"
>;

export interface UpdateService {
	getState(): UpdateState;
	onStateChange(listener: (state: UpdateState) => void): () => void;
	check(): Promise<UpdateState>;
	download(): Promise<UpdateState>;
	/** Flushes pending saves, then hands off to the updater (which quits the app). */
	apply(): Promise<void>;
	scheduleLaunchCheck(opts: { enabled: boolean; delayMs: number }): () => void;
}

export const RESTART_CANCELLED = "Restart was cancelled";

const log = bunLogger.getChild("updater");

function pendingVersion(state: UpdateState): string | null {
	return state.status === "available" || state.status === "downloading"
		? state.version
		: null;
}

function lastProgress(state: UpdateState): number {
	return state.status === "downloading" ? state.progress : 0;
}

/**
 * Maps one Electrobun status entry onto the current state. Entries without a
 * state meaning (checking, patch-*, decompressing, ...) leave it unchanged.
 */
export function reduceStatusEntry(
	state: UpdateState,
	entry: UpdateStatusEntry,
): UpdateState {
	const version = pendingVersion(state);
	switch (entry.status) {
		case "download-progress": {
			if (version === null) return state;
			const progress = entry.details?.progress ?? lastProgress(state);
			return {
				status: "downloading",
				version,
				progress: Math.min(100, Math.max(0, progress)),
			};
		}
		case "download-complete":
			return version === null ? state : { status: "ready", version };
		case "error":
			return { status: "error", message: entry.message };
		case "idle":
			// Electrobun emits `idle` only when a before-quit handler vetoes the
			// update restart; applyUpdate then resolves with the app still running.
			return { status: "error", message: RESTART_CANCELLED };
		default:
			return state;
	}
}

function stateFromInfo(info: UpdateInfo): UpdateState {
	if (info.error) return { status: "error", message: info.error };
	return info.updateAvailable
		? { status: "available", version: info.version }
		: { status: "up-to-date", version: info.version };
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function createUpdateService({
	flushPending,
	seam = platformUpdater,
}: {
	flushPending: () => Promise<void>;
	seam?: UpdaterSeam;
}): UpdateService {
	let state: UpdateState = { status: "idle" };
	const listeners = new Set<(state: UpdateState) => void>();
	let checkInFlight: Promise<UpdateState> | null = null;
	// Read through a function so TS does not keep a narrowing across awaits
	// (status-entry callbacks change `state` meanwhile).
	const getState = (): UpdateState => state;

	function setState(next: UpdateState): void {
		if (next === state) return;
		if (next.status === "error") {
			log.warn`Update error: ${next.message}`;
		} else if (next.status !== state.status) {
			log.info`Update state ${state.status} -> ${next.status}`;
		}
		state = next;
		for (const listener of listeners) listener(state);
	}

	seam.onStatusChange((entry) => setState(reduceStatusEntry(state, entry)));

	async function runCheck(): Promise<UpdateState> {
		const channel = await seam.getReleaseChannel();
		if (channel !== "canary" && channel !== "stable") {
			setState({ status: "disabled", reason: "dev" });
			return state;
		}
		setState({ status: "checking" });
		try {
			setState(stateFromInfo(await seam.checkForUpdate()));
		} catch (error) {
			setState({
				status: "error",
				message: `Failed to check for updates: ${errorMessage(error)}`,
			});
		}
		return state;
	}

	function check(): Promise<UpdateState> {
		// A download in progress or prepared must not be reset by a re-check.
		if (state.status === "downloading" || state.status === "ready") {
			return Promise.resolve(state);
		}
		checkInFlight ??= runCheck().finally(() => {
			checkInFlight = null;
		});
		return checkInFlight;
	}

	async function download(): Promise<UpdateState> {
		if (state.status !== "available") return state;
		const { version } = state;
		setState({ status: "downloading", version, progress: 0 });
		try {
			await seam.downloadUpdate();
		} catch (error) {
			setState({ status: "error", message: errorMessage(error) });
		}
		// No download-complete / error entry arrived: settle from UpdateInfo.
		if (getState().status === "downloading") {
			const info = seam.updateInfo();
			setState(
				info.updateReady
					? { status: "ready", version }
					: {
							status: "error",
							message: info.error || "Download did not complete",
						},
			);
		}
		return state;
	}

	async function apply(): Promise<void> {
		try {
			// R3: an async before-quit handler gets no event-loop time under
			// applyUpdate, so pending saves are flushed here, first.
			await flushPending();
			await seam.applyUpdate();
		} catch (error) {
			setState({ status: "error", message: errorMessage(error) });
		}
	}

	return {
		getState,
		onStateChange(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		check,
		download,
		apply,
		scheduleLaunchCheck({ enabled, delayMs }) {
			if (!enabled) {
				return () => {
					// nothing scheduled
				};
			}
			const timer = setTimeout(() => {
				void check();
			}, delayMs);
			return () => clearTimeout(timer);
		},
	};
}
