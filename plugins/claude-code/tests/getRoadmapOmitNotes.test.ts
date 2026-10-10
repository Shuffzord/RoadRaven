// getRoadmap `omitNotes`: the MCP server strips node notes from the app's
// result (never forwarding the arg), keeping the payload under Claude Code's
// tool-result limit.
import { describe, expect, it, vi } from "vitest";
import { getRoadmapCallback } from "../src/tools/agentToolCallback";

const tree = {
	schema: {
		title: "R",
		nodes: [
			{
				id: "a",
				title: "A",
				status: "done",
				type: "task",
				notes: "big",
				metadata: { k: "v" },
				children: [{ id: "b", title: "B", notes: "x", children: [] }],
			},
		],
	},
	revision: 7,
};

const run = async (args: Record<string, unknown>) => {
	const client = { request: vi.fn().mockResolvedValue(structuredClone(tree)) };
	const result = await getRoadmapCallback(client)(args);
	return { client, out: JSON.parse(result.content[0].text) };
};

describe("getRoadmap omitNotes", () => {
	it("strips notes recursively and keeps every other field", async () => {
		const { client, out } = await run({ omitNotes: true });
		expect(JSON.stringify(out)).not.toContain("notes");
		const a = out.schema.nodes[0];
		expect(a).toMatchObject({
			id: "a",
			title: "A",
			status: "done",
			type: "task",
			metadata: { k: "v" },
		});
		expect(a.children[0].title).toBe("B");
		expect(out.revision).toBe(7);
		expect(client.request).toHaveBeenCalledWith("getRoadmap", {});
	});

	it.each([{}, { omitNotes: false }])("keeps notes for %j", async (args) => {
		const { client, out } = await run(args);
		expect(out).toEqual(tree);
		expect(client.request).toHaveBeenCalledWith("getRoadmap", {});
	});
});

describe("getRoadmap omitNotes passthrough", () => {
	// request() resolving undefined makes the base callback's text undefined
	// (JSON.stringify(undefined)), i.e. a success body that is not JSON.
	it("returns a non-JSON success body unchanged without throwing", async () => {
		const client = { request: vi.fn().mockResolvedValue(undefined) };
		const out = await getRoadmapCallback(client)({ omitNotes: true });
		expect(out.isError).toBeUndefined();
		expect(out.content[0].text).toBeUndefined();
	});
});
