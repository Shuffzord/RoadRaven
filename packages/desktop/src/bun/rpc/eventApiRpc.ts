import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import type { EventServerHandle } from "../eventServer";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

export interface EventApiRpcContext {
	getEventServerHandle: () => EventServerHandle | null;
	getState: () => BunRequests["getEventApiState"]["response"];
}

export function createEventApiRpcHandlers(ctx: EventApiRpcContext): {
	setNodeAllowlist: RpcHandler<"setNodeAllowlist">;
	getEventApiState: RpcHandler<"getEventApiState">;
} {
	return {
		// setNodeAllowlist handler — routes to the event server's classification allowlist
		setNodeAllowlist: ({ nodeIds, statusIds }) => {
			ctx.getEventServerHandle()?.setAllowlist(nodeIds, statusIds);
			return { ok: true as const };
		},

		// getEventApiState handler — renderer pulls current state on mount.
		// The Bun-side push at startup races bundle load and is dropped silently
		// if the renderer's RPC handlers haven't registered yet (UAT D-07
		// regression: pill / welcome URL line stuck at "off").
		getEventApiState: () => {
			return ctx.getState();
		},
	};
}
