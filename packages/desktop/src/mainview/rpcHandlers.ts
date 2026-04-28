/**
 * RPC message handlers for incoming messages from the Bun process.
 * Separated from rpc.ts to avoid circular imports between rpc and roadmapStore.
 * Uses dynamic import() for ESM safety -- no require().
 *
 * Plan 03-04c (D-14): pushFileChanged now delegates to useFileActions'
 * `handleExternalFileChange` so the dirty-vs-clean decision lives in one
 * place — covered by tests/unit/store/fileActions.test.ts. The clean-state
 * branch preserves Phase 2's auto-reload behavior; the dirty branch routes
 * through setExternalEdit → ExternalEditToast.
 *
 * Plan 04-03: Added pushStatusUpdate, pushEventApiState, pushEventApiError,
 * and pushEventLog (no-op stub until Plan 04-04).
 */
// fallow-ignore-next-line circular-dependency
// Cycle useFileActions → rpc → rpcHandlers → useFileActions is broken at
// runtime by the dynamic import() below; flagged by static graph only.
import type { IntegrationEvent } from "../../../../shared/types";

export async function handlePushFileChanged(msg: {
	path: string;
}): Promise<void> {
	const { handleExternalFileChange } = await import("./hooks/useFileActions");
	await handleExternalFileChange(msg);
}

/**
 * pushStatusUpdate — applies batched node status updates in-place via
 * applyEventBatch. Does NOT bump dataKey (PLUG-03 dataKey invariant).
 */
export async function handlePushStatusUpdate(msg: {
	updates: Array<{
		nodeId: string;
		status: string;
		meta?: Record<string, unknown>;
		source?: string;
		lastEventAt: number;
	}>;
}): Promise<void> {
	const { useRoadmapStore } = await import("./store/roadmapStore");
	useRoadmapStore.getState().applyEventBatch(msg.updates);
}

/**
 * pushEventApiState — forwards Bun-side server state to eventApiStore.
 * Drives the EventApiPill colour state machine (D-06, I-09 fix).
 */
export async function handlePushEventApiState(msg: {
	status: "off" | "listening" | "error";
	port: number | null;
	connectedCount: number;
	errorMessage: string | null;
}): Promise<void> {
	const { useEventApiStore } = await import("./store/eventApiStore");
	useEventApiStore.getState().setState(msg);
}

/**
 * pushEventApiError — pushes a toast for malformed/unknown_node/invalid_status
 * /disconnect events received by the Bun WebSocket server (PLUG-06, D-23).
 */
export async function handlePushEventApiError(msg: {
	type: "malformed" | "unknown_node" | "invalid_status" | "disconnect";
	source: string;
	detail?: string;
}): Promise<void> {
	const { useToastStore } = await import("./store/toastStore");
	useToastStore.getState().pushToast(msg);
}

/**
 * pushEventLog — appends received events into the in-memory eventLogStore
 * sliding window (capped at EVENT_LOG_ROW_CAP=1000). Plan 04-04 wires this
 * (I-20 wave-order compromise: was a no-op in Plan 04-03).
 */
export async function handlePushEventLog(msg: {
	events: IntegrationEvent[];
}): Promise<void> {
	const { useEventLogStore } = await import("./store/eventLogStore");
	useEventLogStore.getState().appendEvents(msg.events);
}
