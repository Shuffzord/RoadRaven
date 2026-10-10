// revealNode: the MCP server exposes the app's "select, centre and raise the
// window" tool, forwarding { nodeId } unchanged (the HUD's Go to app button
// calls it by this name).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { agentToolCallback } from "../src/tools/agentToolCallback";

const SERVER_TS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), ".."),
	"src",
	"server.ts",
);

describe("revealNode", () => {
	it("is registered, takes a nodeId and forwards to the app's revealNode", () => {
		const source = readFileSync(SERVER_TS, "utf8");
		expect(source).toMatch(
			/registerTool\(\s*"revealNode",[\s\S]*?inputSchema: GetNodeInputSchema,[\s\S]*?agentToolCallback\("revealNode", wsClient\)/,
		);
	});

	it("forwards the nodeId and returns the app's reply", async () => {
		const client = { request: vi.fn().mockResolvedValue({ ok: true }) };
		const out = await agentToolCallback("revealNode", client)({ nodeId: "n" });
		expect(client.request).toHaveBeenCalledWith("revealNode", { nodeId: "n" });
		expect(JSON.parse(out.content[0].text)).toEqual({ ok: true });
	});
});
