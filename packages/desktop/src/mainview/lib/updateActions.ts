import type { UpdateState } from "../../../../../shared/types";
import { ensureSafeToDiscard } from "../hooks/useFileActions";
import { electroview } from "../rpc";
import { useUpdateStore } from "../store/updateStore";

/**
 * v0.8.5 update actions — module-level so the prompt, the status-bar pill and
 * Preferences each call one function. Only these write updateStore besides
 * the pushUpdateState handler. Outside Electrobun (HMR dev server) there is
 * no RPC and every action returns "unavailable".
 */

type UpdateActionResult = "done" | "failed" | "unavailable";
type RestartResult = "restarting" | "cancelled" | "failed" | "unavailable";

type Rpc = NonNullable<NonNullable<typeof electroview>["rpc"]>;

async function storeResponse(
	request: (rpc: Rpc) => Promise<UpdateState>,
): Promise<UpdateActionResult> {
	const rpc = electroview?.rpc;
	if (!rpc) return "unavailable";
	try {
		useUpdateStore.getState().setState(await request(rpc));
		return "done";
	} catch {
		// The service pushes its own error state; a failed RPC leaves ours as is.
		return "failed";
	}
}

/** Seed the store once on mount — the startup push can race bundle load. */
export async function pullUpdateState(): Promise<void> {
	await storeResponse((rpc) => rpc.request.getUpdateState({}));
}

export function checkForUpdates(): Promise<UpdateActionResult> {
	return storeResponse((rpc) => rpc.request.checkForUpdate({}));
}

export function downloadUpdate(): Promise<UpdateActionResult> {
	return storeResponse((rpc) => rpc.request.downloadUpdate({}));
}

/**
 * Restart into the downloaded update. Updater.applyUpdate consults only
 * `before-quit`, not the window will-close guard (Phase 0 R3), so the unsaved
 * work guard runs here first — an untitled roadmap with edits is never lost.
 *
 * The pill stays rendered while ensureSafeToDiscard() awaits the user's
 * answer, so a double-click can fire this twice; restartInFlight (same
 * pattern as checkInFlight in src/bun/updater/updateService.ts) makes a
 * second call while one is pending return the same promise.
 */
let restartInFlight: Promise<RestartResult> | null = null;

async function runRestartToUpdate(): Promise<RestartResult> {
	const rpc = electroview?.rpc;
	if (!rpc) return "unavailable";
	const ok = await ensureSafeToDiscard();
	if (!ok) return "cancelled";
	const result = await rpc.request.applyUpdate({});
	if (!result.ok) {
		useUpdateStore.getState().setState({
			status: "error",
			message: result.error ?? "Restart failed",
		});
		return "failed";
	}
	// The process is about to quit — nothing else to do.
	return "restarting";
}

export function restartToUpdate(): Promise<RestartResult> {
	restartInFlight ??= runRestartToUpdate().finally(() => {
		restartInFlight = null;
	});
	return restartInFlight;
}

/** The Preferences › About status line for a state. */
export function describeUpdateState(state: UpdateState): string {
	switch (state.status) {
		case "idle":
			return "Not checked yet.";
		case "up-to-date":
			return "You're on the latest version.";
		case "checking":
			return "Checking…";
		case "available":
			return `Version ${state.version} is available.`;
		case "downloading":
			return `Downloading version ${state.version}… ${Math.round(state.progress)} %`;
		case "ready":
			return `Version ${state.version} is ready. Restart to update.`;
		case "error":
			// Verbatim: the service's messages already say what failed
			// ("Failed to check for updates: …", "Restart was cancelled", …).
			return state.message;
		case "disabled":
			return "Updates are disabled in dev builds.";
	}
}
