// tests/release/hud-mcp-contract.test.ts
//
// The HUD mod (plugins/roadraven-hud) reads the MCP server's tool text, which
// plugins/claude-code writes. The two ship separately, so this pins the shared
// contract: what agentToolCallback writes is what the HUD's roadmap.ts parses.
import { describe, expect, it } from "vitest";
import { agentToolCallback } from "../../plugins/claude-code/src/tools/agentToolCallback";
import {
	codeOf,
	connKind,
	parseReply,
} from "../../plugins/roadraven-hud/hooks/roadmap";

// The text the HUD sees for a call answered with `reply`, or rejected with `error`.
async function textFor(reply: { ok: unknown } | { error: unknown }) {
	const client = {
		request: () =>
			"ok" in reply ? Promise.resolve(reply.ok) : Promise.reject(reply.error),
	};
	const out = await agentToolCallback("revealNode", client)({ nodeId: "n" });
	return out.content[0]?.text ?? "";
}

describe("HUD ↔ MCP server tool text", () => {
	it("a reply parses back to the app's data", async () => {
		const data = { nodes: [{ node: { id: "a", title: "A" }, parentId: null }] };
		expect(parseReply(await textFor({ ok: data }))).toEqual(data);
	});

	it.each([
		["unknown_tool", "other"],
		["stale_write", "other"],
		["no_file_loaded", "noFile"],
		["app_not_running", "offline"],
		["result_too_large", "tooLarge"],
	])("a structured %s error reads as its code (%s)", async (code, kind) => {
		const text = await textFor({
			error: { code, message: "m", hint: "h", data: { x: 1 } },
		});
		expect(codeOf(text)).toBe(code);
		expect(connKind(text)).toBe(kind);
		expect(() => parseReply(text)).toThrow();
	});
});
