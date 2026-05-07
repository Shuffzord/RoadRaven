// Phase 6 Plan 06-03 — Bun-side gate layer tests.
// 6 tests, anti-sprawl: one per gate, plus happy-path. Cross-ref-boundary gate
// exists in source but is asserted by grep (not test); rationale: scaffold flow
// never crosses $ref boundaries — UAT in 06-06 covers it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRequest } from "../../../src/bun/eventSchema";

// Mock the OUTBOUND boundary modules. Internal helpers stay real.
vi.mock("../../../src/bun/settings", () => ({
	loadSettings: vi.fn(() => ({})), // default: kill-switch absent → enabled
}));
vi.mock("../../../src/bun/saveFile", () => ({
	isPathWithinMainDir: vi.fn(() => true),
	pushDialogAllowlistPath: vi.fn(),
}));
vi.mock("../../../src/bun/refMap", () => ({
	getOwnership: vi.fn(() => undefined), // default: no $ref ownership constraint
}));

import { agentRequestHandler } from "../../../src/bun/agentRequestHandler";
import { isPathWithinMainDir } from "../../../src/bun/saveFile";
import { loadSettings } from "../../../src/bun/settings";

function makeWs() {
	const sent: string[] = [];
	const ws = {
		data: {
			id: "test",
			source: "claude-code",
			version: "0.1.0",
			helloAt: 0,
			connectedAt: 0,
		},
		send: vi.fn((s: string) => {
			sent.push(s);
		}),
	};
	return { ws: ws as never, sent };
}

function makeRequest(
	method: string,
	params: Record<string, unknown>,
): AgentRequest {
	return { type: "request", id: `req-${method}`, method, params };
}

function makeMainWindow(
	handler: (params: {
		tool: string;
		args: Record<string, unknown>;
	}) => Promise<unknown>,
) {
	return {
		webview: {
			rpc: {
				request: { agentRequest: vi.fn(handler as never) },
			},
		},
	} as never;
}

describe("agentRequestHandler — kill-switch (RESEARCH §13)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	// RED: it.fails() → test passes when implementation throws (the GREEN task in
	// Plan 06-03 changes it.fails() back to it() and the assertions then enforce
	// the real behaviour). This pattern lets the pre-commit vitest hook accept
	// the RED commit without --no-verify; project policy is strict about hooks.
	it.fails("returns agent_api_disabled when agentApi.enabled === false (T1)", async () => {
		vi.mocked(loadSettings).mockReturnValue({ agentApi: { enabled: false } });
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => {
			throw new Error("should not be called");
		});
		await agentRequestHandler(ws, makeRequest("getRoadmap", {}), mainWindow);
		expect(sent.length).toBe(1);
		const env = JSON.parse(sent[0]);
		expect(env.type).toBe("response");
		expect(env.id).toBe("req-getRoadmap");
		expect(env.error.code).toBe("agent_api_disabled");
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
	});
});

describe("agentRequestHandler — path-allowlist (D-13)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.fails("saveFileAs returns path_not_permitted when isPathWithinMainDir is false (T2)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		vi.mocked(isPathWithinMainDir).mockReturnValue(false);
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: { ok: true },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("saveFileAs", { path: "/etc/passwd" }),
			mainWindow,
		);
		expect(sent.length).toBe(1);
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("path_not_permitted");
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
	});

	it.fails("openFile returns path_not_permitted when isPathWithinMainDir is false (T3)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		vi.mocked(isPathWithinMainDir).mockReturnValue(false);
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({ ok: true, data: {} }));
		await agentRequestHandler(
			ws,
			makeRequest("openFile", { path: "/etc/shadow" }),
			mainWindow,
		);
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("path_not_permitted");
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
	});
});

describe("agentRequestHandler — cascade gate (D-11) end-to-end", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.fails("forwards deleteNode to renderer; renderer-returned cascade_required is sent back as ws envelope (T4)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: false,
			error: "Node has 3 children. Pass cascade:true to delete subtree.",
			code: "cascade_required",
			data: { childCount: 3 },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("deleteNode", {
				nodeId: "00000000-0000-0000-0000-000000000000",
			}),
			mainWindow,
		);
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).toHaveBeenCalledOnce();
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("cascade_required");
		expect(env.error.data).toEqual({ childCount: 3 });
	});
});

describe("agentRequestHandler — happy path", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.fails("forwards method+params to mainWindow.webview.rpc.request.agentRequest and sends back result (T5)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async ({ tool, args }) => {
			expect(tool).toBe("getRoadmap");
			expect(args).toEqual({});
			return { ok: true, data: { schema: { id: "root" } } };
		});
		await agentRequestHandler(ws, makeRequest("getRoadmap", {}), mainWindow);
		const env = JSON.parse(sent[0]);
		expect(env.type).toBe("response");
		expect(env.id).toBe("req-getRoadmap");
		expect(env.result).toEqual({ schema: { id: "root" } });
		expect(env.error).toBeUndefined();
	});
});

describe("agentRequestHandler — unknown method passthrough", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.fails("does NOT short-circuit unknown methods; renderer returns unknown_tool which Bun forwards (T6)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: false,
			error: "Unknown agent tool: 'foobar'.",
			code: "unknown_tool",
			hint: "Update the plugin to a version that matches the app.",
		}));
		await agentRequestHandler(ws, makeRequest("foobar", {}), mainWindow);
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).toHaveBeenCalledWith({
			tool: "foobar",
			args: {},
		});
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("unknown_tool");
	});
});
