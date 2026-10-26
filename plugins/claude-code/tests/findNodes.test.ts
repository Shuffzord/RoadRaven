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
		// The app filters by one status string, so the mock answers per status.
		const answer = (result: unknown, args: Record<string, unknown>) => {
			const nodes = (result as { nodes?: ReturnType<typeof mk>[] }).nodes;
			return typeof args.status === "string" && Array.isArray(nodes)
				? { nodes: nodes.filter((m) => m.node.status === args.status) }
				: result;
		};
		const run = async (args: Record<string, unknown>, result: unknown) => {
			const client = {
				request: vi.fn((_m, a) => Promise.resolve(answer(result, a))),
			};
			const out = await findNodesCallback(client)(args);
			return { client, body: JSON.parse(out.content[0].text) };
		};

		const perStatus = (args: Record<string, unknown>) =>
			Promise.resolve(answer(many(), args));

		it("asks the app once per listed status, keeps other filters, and joins in list order", async () => {
			const client = { request: vi.fn((_m, a) => perStatus(a)) };
			const out = await findNodesCallback(client)({
				status: ["blocked", "in-progress"],
				type: "uat",
			});
			expect(client.request.mock.calls).toEqual([
				["findNodes", { type: "uat", status: "blocked" }],
				["findNodes", { type: "uat", status: "in-progress" }],
			]);
			expect(
				JSON.parse(out.content[0].text).nodes.map(
					(m: { node: { id: string } }) => m.node.id,
				),
			).toEqual(["c", "a"]);
		});

		it("answers the structured error when one of the per-status calls fails", async () => {
			const client = {
				request: vi.fn((_m, a) =>
					a.status === "blocked"
						? Promise.reject({ code: "no_file_loaded", message: "No file" })
						: perStatus(a),
				),
			};
			const out = await findNodesCallback(client)({
				status: ["in-progress", "blocked"],
			});
			expect(out).toEqual({
				content: [{ type: "text", text: "Error (no_file_loaded): No file" }],
				isError: true,
			});
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
