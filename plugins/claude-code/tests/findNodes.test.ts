// findNodes: the MCP server drops each match's subtree so a status query that
// matches the root cannot pull the whole tree back. Notes, metadata and
// parentId stay (the HUD reads notes from findNodes).
import { describe, expect, it, vi } from "vitest";
import { findNodesCallback } from "../src/tools/agentToolCallback";

const reply = {
	nodes: [
		{
			node: {
				id: "a",
				title: "A",
				status: "in-progress",
				notes: "n",
				metadata: { k: "v" },
				children: [{ id: "b", title: "B", notes: "deep", children: [] }],
			},
			parentId: "root",
		},
	],
};

describe("findNodes", () => {
	it("returns matches without children, keeping notes, metadata and parentId", async () => {
		const client = { request: vi.fn().mockResolvedValue(reply) };
		const out = await findNodesCallback(client)({ status: "in-progress" });
		expect(client.request).toHaveBeenCalledWith("findNodes", {
			status: "in-progress",
		});
		expect(JSON.parse(out.content[0].text)).toEqual({
			nodes: [
				{
					node: {
						id: "a",
						title: "A",
						status: "in-progress",
						notes: "n",
						metadata: { k: "v" },
					},
					parentId: "root",
				},
			],
		});
	});

	it("passes a structured error through unchanged", async () => {
		const client = {
			request: vi
				.fn()
				.mockRejectedValue({ code: "no_file_loaded", message: "No file" }),
		};
		const out = await findNodesCallback(client)({});
		expect(out).toEqual({
			content: [{ type: "text", text: "Error (no_file_loaded): No file" }],
			isError: true,
		});
	});
});
