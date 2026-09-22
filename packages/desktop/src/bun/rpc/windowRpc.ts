import { existsSync } from "node:fs";
import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import { bunLogger } from "../logging";
import { showItemInFolder } from "../platform/shell";
import { setMainWindowTitle } from "../platform/window";
import type { MainWindow } from "./fileRpc";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

export interface WindowRpcContext {
	getMainWindow: () => MainWindow;
}

// -- v0.8.2 file UX: window title + reveal-in-folder ---------------------------

export function createWindowRpcHandlers(ctx: WindowRpcContext): {
	setWindowTitle: RpcHandler<"setWindowTitle">;
	revealInFolder: RpcHandler<"revealInFolder">;
} {
	return {
		// setWindowTitle: renderer mirrors the open file's identity into the OS
		// title bar (F2).
		setWindowTitle: ({ title }) => {
			setMainWindowTitle(ctx.getMainWindow(), title);
		},

		// revealInFolder: only paths that exist reach the platform seam — the OS
		// call is fire-and-forget, so this is the one check that can fail loudly.
		revealInFolder: ({ path }) => {
			if (!existsSync(path)) {
				bunLogger.warn`revealInFolder: ${path} does not exist`;
				return { ok: false };
			}
			return showItemInFolder(path);
		},
	};
}
