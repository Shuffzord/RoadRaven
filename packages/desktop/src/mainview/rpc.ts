import { Electroview } from "electrobun/view";
import type { RoadmapNode, RoadmapRPCType } from "../../../../shared/types";
import { useRoadmapStore } from "./store/roadmapStore";

const rpc = Electroview.defineRPC<RoadmapRPCType>({
	maxRequestTime: 120_000, // 2 min — native file dialogs block until user picks a file
	handlers: {
		requests: {},
		messages: {
			pushFileChanged: (msg) => {
				import("./rpcHandlers").then(({ handlePushFileChanged }) => {
					handlePushFileChanged(msg);
				});
			},
			pushStatusUpdate: (msg) => {
				// Narrow the union: only handle the batched shape (Plan 04-03+)
				if ("updates" in msg) {
					import("./rpcHandlers").then(({ handlePushStatusUpdate }) => {
						handlePushStatusUpdate(msg as { updates: Array<{ nodeId: string; status: string; meta?: Record<string, unknown>; source?: string; lastEventAt: number }> });
					});
				}
				// Legacy single-node shape: silently drop (RETAIN for Wave 0 build-green;
				// removed after Plan 04-03 is confirmed stable)
			},
			pushEventLog: (msg) => {
				import("./rpcHandlers").then(({ handlePushEventLog }) => {
					handlePushEventLog(msg);
				});
			},
			pushEventApiState: (msg) => {
				import("./rpcHandlers").then(({ handlePushEventApiState }) => {
					handlePushEventApiState(msg);
				});
			},
			pushEventApiError: (msg) => {
				import("./rpcHandlers").then(({ handlePushEventApiError }) => {
					handlePushEventApiError(msg);
				});
			},
			pushOwnershipMap: (msg) => {
				// Ownership map is consumed by refMap — see index.ts bun side.
				// No renderer-side action needed currently.
				void msg;
			},
		},
	},
});

// Electroview constructor throws in regular browsers (HMR dev mode)
// because the WebSocket URL requires Electrobun's native context.
// Graceful fallback keeps React rendering for UI development.
let instance: Electroview<typeof rpc> | null = null;
try {
	instance = new Electroview({ rpc });
} catch {
	// Running outside Electrobun (e.g. localhost:5173 in browser)
}

export const electroview = instance;

/**
 * pushAllowlistFromStore — collect all node IDs and status IDs from the current
 * schema and send setNodeAllowlist to the Bun process. Called on mount and on
 * every dataKey / statusConfig change (RESEARCH §2.3 Pitfall 3, I-01 resolution).
 *
 * Uses `schema.nodes` (NOT schema.rootNodes — verified 2026-04-23).
 */
export async function pushAllowlistFromStore(): Promise<void> {
	const { schema } = useRoadmapStore.getState();
	if (!schema) return;

	const nodeIds: string[] = [];
	const walk = (n: RoadmapNode) => {
		nodeIds.push(n.id);
		n.children?.forEach(walk);
	};
	schema.nodes.forEach(walk);

	const statusIds = (schema.statusConfig ?? []).map((s) => s.id);

	try {
		await electroview?.rpc?.request.setNodeAllowlist({ nodeIds, statusIds });
	} catch {
		// RPC may fail during startup before Bun is ready; silently ignore
	}
}
