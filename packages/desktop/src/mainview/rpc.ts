import { Electroview } from "electrobun/view";
import type { RoadmapRPCType } from "../../../../shared/types";

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
			pushStatusUpdate: () => {
				// Phase 3: wire to roadmapStore.updateNodeStatus
			},
			pushEventLog: () => {
				// Phase 3: wire to event logging
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
