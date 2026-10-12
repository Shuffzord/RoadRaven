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
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
				metadata: { k: "v" },
				children: [
					{
						id: "b",
						title: "B",
						notes: "x",
						createdAt: "2026-01-03T00:00:00.000Z",
						updatedAt: "2026-01-04T00:00:00.000Z",
						children: [],
					},
				],
			},
		],
	},
	revision: 7,
};

const run = async (args: Record<string, unknown>) => {
	const client = { request: vi.fn().mockResolvedValue(structuredClone(tree)) };
	const result = await getRoadmapCallback(client)(args);
	const text = result.content[0].text;
	return { client, text, out: JSON.parse(text) };
};

describe("getRoadmap omitNotes", () => {
	it("strips notes and timestamps recursively and keeps every other field", async () => {
		const { client, text, out } = await run({ omitNotes: true });
		expect(text).not.toContain("notes");
		expect(text).not.toContain("createdAt");
		expect(text).not.toContain("updatedAt");
		expect(text).toBe(JSON.stringify(out));
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
		const { client, text, out } = await run(args);
		expect(out).toEqual(tree);
		expect(text).toBe(JSON.stringify(tree));
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
