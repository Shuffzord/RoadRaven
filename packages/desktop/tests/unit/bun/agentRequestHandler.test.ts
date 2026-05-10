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
	getCachedMainPath: vi.fn(() => null), // default: no main file → no fallback
}));
vi.mock("../../../src/bun/refMap", () => ({
	getOwnership: vi.fn(() => new Map<string, string>()), // CR-03: real Map default
	setOwnership: vi.fn(),
}));

import { agentRequestHandler } from "../../../src/bun/agentRequestHandler";
import { getOwnership, setOwnership } from "../../../src/bun/refMap";
import {
	getCachedMainPath,
	isPathWithinMainDir,
} from "../../../src/bun/saveFile";
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

	it("returns agent_api_disabled when agentApi.enabled === false (T1)", async () => {
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

	it("saveFileAs returns path_not_permitted when isPathWithinMainDir is false (T2)", async () => {
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

	it("openFile returns path_not_permitted when isPathWithinMainDir is false (T3)", async () => {
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

	it("forwards deleteNode to renderer; renderer-returned cascade_required is sent back as ws envelope (T4)", async () => {
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

	it("forwards method+params to mainWindow.webview.rpc.request.agentRequest and sends back result (T5)", async () => {
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

	it("does NOT short-circuit unknown methods; renderer returns unknown_tool which Bun forwards (T6)", async () => {
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

// WR-01 (06-REVIEW): per-tool input validation rejects malformed args BEFORE
// they reach the renderer. The frame envelope schema (eventSchema.ts) only
// validates the wrapper; without per-tool checks a direct WS client could
// silently corrupt state via patch=null, position="first", patch=42, etc.
describe("agentRequestHandler — input validation (WR-01)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("updateNodeMetadata({patch: null}) returns invalid_input (WR-01)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: { ok: true },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("updateNodeMetadata", {
				nodeId: "00000000-0000-0000-0000-000000000000",
				patch: null,
			}),
			mainWindow,
		);
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("invalid_input");
		expect(env.error.message).toContain("patch");
	});

	it('moveNode({position: "first"}) returns invalid_input — string position rejected (WR-01)', async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: { ok: true },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("moveNode", {
				nodeId: "00000000-0000-0000-0000-000000000001",
				newParentId: "00000000-0000-0000-0000-000000000002",
				position: "first",
			}),
			mainWindow,
		);
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("invalid_input");
	});

	it("createNode without title returns invalid_input (WR-01)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: { nodeId: "x" },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("createNode", {
				parentId: "00000000-0000-0000-0000-000000000001",
				// missing title
			}),
			mainWindow,
		);
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("invalid_input");
	});

	// WR-01 forward-compat: tools not in the schema registry pass through
	// (lets new plugin versions ship tools the desktop hasn't seen yet —
	// the renderer returns unknown_tool for genuinely unknown methods).
	it("unknown method passes input validation (forward compat)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: false,
			error: "Unknown agent tool: 'futureTool'.",
			code: "unknown_tool",
		}));
		await agentRequestHandler(
			ws,
			makeRequest("futureTool", { whatever: 42 }),
			mainWindow,
		);
		// Validation passed (forward-compat); renderer rejected.
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("unknown_tool");
	});
});

// CR-03 (06-REVIEW): cross-ref boundary gate must NOT fail open for nodes
// missing from the ownership map. The original code returned silently when
// either side's owner was undefined; the fix records ownership on createNode
// and defaults missing entries to the cached main file when checking moveNode.
describe("agentRequestHandler — cross-ref boundary gate (CR-03)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("createNode: records ownership for the new node inheriting parent's owner (CR-03)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		// Parent is owned by /main.json. Render-side returns a new id.
		const ownership = new Map<string, string>([["parent-A", "/main.json"]]);
		vi.mocked(getOwnership).mockReturnValue(ownership);
		vi.mocked(getCachedMainPath).mockReturnValue("/main.json");
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: { nodeId: "new-child-1" },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("createNode", { parentId: "parent-A", title: "Child" }),
			mainWindow,
		);
		// Successful response forwarded to client.
		const env = JSON.parse(sent[0]);
		expect(env.result).toEqual({ nodeId: "new-child-1" });
		// AND the new node's ownership has been recorded as the parent's owner.
		expect(setOwnership).toHaveBeenCalledWith("new-child-1", "/main.json");
	});

	it("moveNode: rejects cross-boundary move where one side lacks explicit ownership (CR-03 fail-open closed)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		// Setup: target node is owned by a $ref file, but the source node
		// (e.g. agent-created moments ago) has no entry in the map. Old code
		// would skip the gate; new code defaults source to cachedMainPath
		// and rejects with cross_ref_boundary because main.json !== ref.json.
		const ownership = new Map<string, string>([
			["dest-parent", "/refs/foo.json"],
		]);
		vi.mocked(getOwnership).mockReturnValue(ownership);
		vi.mocked(getCachedMainPath).mockReturnValue("/main.json");
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: {},
		}));
		await agentRequestHandler(
			ws,
			makeRequest("moveNode", {
				nodeId: "agent-created", // not in map
				newParentId: "dest-parent", // owned by /refs/foo.json
			}),
			mainWindow,
		);
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).not.toHaveBeenCalled();
		const env = JSON.parse(sent[0]);
		expect(env.error.code).toBe("cross_ref_boundary");
	});

	it("moveNode: allows in-main-file move when both sides default to cachedMainPath (CR-03 fail-closed false-positive guard)", async () => {
		vi.mocked(loadSettings).mockReturnValue({});
		// No explicit ownership entries; both sides fall back to cachedMainPath.
		// Without a valid fallback the gate would over-reject; verify it allows.
		const ownership = new Map<string, string>();
		vi.mocked(getOwnership).mockReturnValue(ownership);
		vi.mocked(getCachedMainPath).mockReturnValue("/main.json");
		const { ws, sent } = makeWs();
		const mainWindow = makeMainWindow(async () => ({
			ok: true,
			data: { ok: true },
		}));
		await agentRequestHandler(
			ws,
			makeRequest("moveNode", {
				nodeId: "node-A",
				newParentId: "node-B",
			}),
			mainWindow,
		);
		// Forwarded to renderer (gate passed because both sides default to /main.json).
		expect(
			(
				mainWindow as {
					webview: { rpc: { request: { agentRequest: unknown } } };
				}
			).webview.rpc.request.agentRequest,
		).toHaveBeenCalledOnce();
		const env = JSON.parse(sent[0]);
		expect(env.error).toBeUndefined();
		expect(env.result).toEqual({ ok: true });
	});
});
