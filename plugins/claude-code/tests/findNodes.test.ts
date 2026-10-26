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

	describe("status list and omitNotes (applied in the MCP server)", () => {
		const mk = (id: string, status: string) => ({
			node: {
				id,
				title: id,
				status,
				notes: `notes ${id}`,
				createdAt: "c",
				updatedAt: "u",
				metadata: { k: id },
				children: [{ id: `${id}-child`, notes: "deep" }],
			},
			parentId: "root",
		});
		const many = () => ({
			nodes: [
				mk("a", "in-progress"),
				mk("b", "completed"),
				mk("c", "blocked"),
				mk("d", "not-started"),
			],
		});
		const run = async (args: Record<string, unknown>, result: unknown) => {
			const client = { request: vi.fn().mockResolvedValue(result) };
			const out = await findNodesCallback(client)(args);
			return { client, body: JSON.parse(out.content[0].text) };
		};

		it("asks the app without status for a list and keeps only listed statuses, in order", async () => {
			const { client, body } = await run(
				{ status: ["in-progress", "blocked"], type: "uat" },
				many(),
			);
			expect(client.request).toHaveBeenCalledWith("findNodes", { type: "uat" });
			expect(
				body.nodes.map((m: { node: { id: string } }) => m.node.id),
			).toEqual(["a", "c"]);
		});

		it("forwards a string status to the app as before", async () => {
			const { client } = await run({ status: "in-progress" }, many());
			expect(client.request).toHaveBeenCalledWith("findNodes", {
				status: "in-progress",
			});
		});

		it("omitNotes drops notes and timestamps, keeps metadata and parentId, and is not forwarded", async () => {
			const { client, body } = await run(
				{ type: "uat", omitNotes: true },
				many(),
			);
			expect(client.request).toHaveBeenCalledWith("findNodes", { type: "uat" });
			expect(body.nodes).toHaveLength(4);
			for (const m of body.nodes) {
				expect(m.node).not.toHaveProperty("notes");
				expect(m.node).not.toHaveProperty("createdAt");
				expect(m.node).not.toHaveProperty("updatedAt");
				expect(m.node.metadata).toEqual({ k: m.node.id });
				expect(m.parentId).toBe("root");
			}
		});

		it("combines a status list with omitNotes", async () => {
			const { body } = await run(
				{ status: ["completed"], omitNotes: true },
				many(),
			);
			expect(body.nodes).toEqual([
				{
					node: {
						id: "b",
						title: "b",
						status: "completed",
						metadata: { k: "b" },
					},
					parentId: "root",
				},
			]);
		});

		it("still drops children with the new options", async () => {
			const { body } = await run(
				{ status: ["blocked", "completed"], omitNotes: true },
				many(),
			);
			for (const m of body.nodes) expect(m.node).not.toHaveProperty("children");
		});

		it("passes a non-object result through with the new options", async () => {
			const { body } = await run(
				{ status: ["blocked"], omitNotes: true },
				"nope",
			);
			expect(body).toBe("nope");
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
