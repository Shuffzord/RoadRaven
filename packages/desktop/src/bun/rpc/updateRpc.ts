import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import type { UpdateService } from "../updater/updateService";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

export interface UpdateRpcContext {
	service: UpdateService;
}

export function createUpdateRpcHandlers({ service }: UpdateRpcContext): {
	getUpdateState: RpcHandler<"getUpdateState">;
	checkForUpdate: RpcHandler<"checkForUpdate">;
	downloadUpdate: RpcHandler<"downloadUpdate">;
	applyUpdate: RpcHandler<"applyUpdate">;
} {
	return {
		// Renderer pulls on mount — the startup push can race bundle load.
		getUpdateState: () => service.getState(),
		checkForUpdate: () => service.check(),
		downloadUpdate: () => service.download(),
		// On success the app quits before this resolves; a response means the
		// restart did not happen.
		applyUpdate: async () => {
			await service.apply();
			const state = service.getState();
			return state.status === "error"
				? { ok: false, error: state.message }
				: { ok: true };
		},
	};
}
