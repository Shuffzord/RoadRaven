// getRoadmap `hideCompleted` / `rootId` / `depth` (v0.9.2 D-1, D-4, D-5): the
// MCP server shapes the app's full tree so a long roadmap fits Claude Code's
// tool-result limit. The app is always asked with no arguments.
import { describe, expect, it, vi } from "vitest";
import { getRoadmapCallback } from "../src/tools/agentToolCallback";

const T = "2026-01-01T00:00:00.000Z";

type N = Record<string, unknown> & { children: N[] };

const node = (
	id: string,
	status: string,
	children: N[] = [],
	extra: Record<string, unknown> = { type: "task" },
): N => ({
	id,
	title: id.toUpperCase(),
	status,
	...extra,
	notes: `${id} notes`,
	metadata: { k: id },
	createdAt: T,
	updatedAt: T,
	children,
});

// r (in-progress)
//   p1 (completed)  — whole subtree completed
//     t1, t2 (no type) > t2a
//   p2 (completed)  — open grandchild
//     t3 > t3a (in-progress), t4 (no type)
//   p3 (in-progress)
//     t5 (completed), t6 (not-started)
// s (not-started, second top-level node)
const tree = {
	schema: {
		title: "R",
		version: 1,
		nodes: [
			node("r", "in-progress", [
				node("p1", "completed", [
					node("t1", "completed"),
					node("t2", "completed", [node("t2a", "completed")], {}),
				]),
				node("p2", "completed", [
					node("t3", "completed", [node("t3a", "in-progress")]),
					node("t4", "completed", [], {}),
				]),
				node("p3", "in-progress", [
					node("t5", "completed"),
					node("t6", "not-started"),
				]),
			]),
			node("s", "not-started"),
		],
	},
	revision: 7,
	filePath: "C:/roadmaps/r.json",
	statusConfig: [{ id: "completed", label: "Done" }],
	typeConfig: [{ id: "task", label: "Task" }],
};

const [r, s] = tree.schema.nodes;
const [p1, p2, p3] = r.children;

const run = async (args: Record<string, unknown>) => {
	const client = { request: vi.fn().mockResolvedValue(structuredClone(tree)) };
	const result = await getRoadmapCallback(client)(args);
	const text = result.content[0].text;
	return { client, result, text, out: JSON.parse(text) };
};

const stub = (n: N, typed = true) => ({
	id: n.id,
	title: n.title,
	status: n.status,
	...(typed ? { type: "task" } : {}),
	childCount: n.children.length,
});

describe("getRoadmap hideCompleted", () => {
	it("turns a fully completed subtree into one stub with its direct child count", async () => {
		const { text, out } = await run({ hideCompleted: true });
		expect(out.schema.nodes[0].children[0]).toEqual(stub(p1));
		expect(stub(p1).childCount).toBe(2);
		expect(text).not.toContain('"t1"');
		expect(text).not.toContain('"t2a"');
		expect(text).not.toContain("p1 notes");
	});

	it("keeps a completed parent with an open grandchild in full", async () => {
		const { out } = await run({ hideCompleted: true });
		const outP2 = out.schema.nodes[0].children[1];
		expect(outP2).toMatchObject({ id: "p2", notes: "p2 notes", createdAt: T });
		const outT3 = outP2.children[0];
		expect(outT3).toMatchObject({ id: "t3", notes: "t3 notes" });
		expect(outT3.children).toEqual([p2.children[0].children[0]]);
		expect(outT3.children[0]).toMatchObject({
			id: "t3a",
			status: "in-progress",
			notes: "t3a notes",
		});
		// A stub of a node without a type has no type key.
		expect(outP2.children[1]).toEqual({
			id: "t4",
			title: "T4",
			status: "completed",
			childCount: 0,
		});
	});

	it("still lists a parent's completed children as stubs, so done/total is countable", async () => {
		const { out } = await run({ hideCompleted: true });
		const kids = out.schema.nodes[0].children[2].children;
		expect(kids).toEqual([stub(p3.children[0]), p3.children[1]]);
		const done = kids.filter(
			(c: { status: string }) => c.status === "completed",
		);
		expect([done.length, kids.length]).toEqual([1, 2]);
		expect(out.schema.nodes[0].children).toHaveLength(3);
		expect(out.schema.nodes[1]).toEqual(s);
	});
});

describe("getRoadmap rootId", () => {
	it("answers only that subtree, with rootId and root-to-parent ancestorIds", async () => {
		const { out } = await run({ rootId: "t3" });
		expect(out.schema.nodes).toEqual([p2.children[0]]);
		expect(out.rootId).toBe("t3");
		expect(out.ancestorIds).toEqual(["r", "p2"]);
		const { schema, rootId: _, ancestorIds: __, ...top } = out;
		const { schema: treeSchema, ...treeTop } = tree;
		expect(top).toEqual(treeTop);
		expect(schema.title).toBe("R");
		expect(schema.version).toBe(1);
	});

	it("gives an empty ancestorIds for a top-level node", async () => {
		const { out } = await run({ rootId: "s" });
		expect(out.schema.nodes).toEqual([s]);
		expect(out.ancestorIds).toEqual([]);
	});

	it("answers node_not_found for an unknown id", async () => {
		const client = {
			request: vi.fn().mockResolvedValue(structuredClone(tree)),
		};
		const result = await getRoadmapCallback(client)({ rootId: "nope" });
		expect(result.isError).toBe(true);
		expect(result.content[0].text.startsWith("Error (node_not_found)")).toBe(
			true,
		);
		expect(result.content[0].text).toContain("nope");
	});
});

describe("getRoadmap rootId with hideCompleted", () => {
	it("returns a fully completed rootId node in full, with its children as stubs", async () => {
		const { out } = await run({ rootId: "p1", hideCompleted: true });
		const [top] = out.schema.nodes;
		expect(top).toMatchObject({ id: "p1", notes: "p1 notes", createdAt: T });
		expect(top.children).toEqual(
			p1.children.map((c) => stub(c, c.type !== undefined)),
		);
	});

	it("keeps the root of a fully completed roadmap a stub without rootId and full with it", async () => {
		const done = node("d", "completed", [node("d1", "completed")]);
		const reqTree = { ...tree, schema: { ...tree.schema, nodes: [done] } };
		const ask = async (args: Record<string, unknown>) => {
			const client = {
				request: vi.fn().mockResolvedValue(structuredClone(reqTree)),
			};
			const res = await getRoadmapCallback(client)(args);
			return JSON.parse(res.content[0].text).schema.nodes;
		};
		expect(await ask({ hideCompleted: true })).toEqual([stub(done)]);
		const [full] = await ask({ rootId: "d", hideCompleted: true });
		expect(full).toMatchObject({ id: "d", notes: "d notes" });
		expect(full.children).toEqual([stub(done.children[0])]);
	});
});

describe("getRoadmap depth", () => {
	it("depth 0 keeps the top nodes and turns their children into stubs", async () => {
		const { out } = await run({ depth: 0 });
		const [outR, outS] = out.schema.nodes;
		expect(outR).toMatchObject({ id: "r", notes: "r notes" });
		expect(outR.children).toEqual([stub(p1), stub(p2), stub(p3)]);
		expect(outS).toEqual(s);
	});

	it("depth 1 keeps one level of children and turns the next into stubs", async () => {
		const { out } = await run({ depth: 1 });
		const [outP1, outP2, outP3] = out.schema.nodes[0].children;
		expect(outP1).toMatchObject({ id: "p1", notes: "p1 notes" });
		expect(outP1.children).toEqual([
			stub(p1.children[0]),
			stub(p1.children[1], false),
		]);
		expect(outP1.children[1].childCount).toBe(1);
		expect(outP2.children).toEqual([
			stub(p2.children[0]),
			stub(p2.children[1], false),
		]);
		expect(outP3.children).toEqual([
			stub(p3.children[0]),
			stub(p3.children[1]),
		]);
	});

	it("counts depth from the rootId node", async () => {
		const { out } = await run({ rootId: "p1", depth: 0 });
		expect(out.schema.nodes).toHaveLength(1);
		expect(out.schema.nodes[0]).toMatchObject({ id: "p1", notes: "p1 notes" });
		expect(out.schema.nodes[0].children).toEqual([
			stub(p1.children[0]),
			stub(p1.children[1], false),
		]);
	});
});

describe("getRoadmap options combined", () => {
	it("applies rootId, depth, hideCompleted and omitNotes together", async () => {
		const { out } = await run({
			rootId: "r",
			depth: 1,
			hideCompleted: true,
			omitNotes: true,
		});
		const lean = (n: N, children: unknown[]) => ({
			id: n.id,
			title: n.title,
			status: n.status,
			type: "task",
			metadata: { k: n.id },
			children,
		});
		expect(out).toEqual({
			schema: {
				title: "R",
				version: 1,
				nodes: [
					lean(r, [
						stub(p1),
						// p2 is completed but has an open descendant below the
						// depth cut, so it stays expanded (D-4).
						lean(p2, [stub(p2.children[0]), stub(p2.children[1], false)]),
						lean(p3, [stub(p3.children[0]), stub(p3.children[1])]),
					]),
				],
			},
			revision: 7,
			filePath: "C:/roadmaps/r.json",
			statusConfig: [{ id: "completed", label: "Done" }],
			typeConfig: [{ id: "task", label: "Task" }],
			rootId: "r",
			ancestorIds: [],
		});
	});
});

describe("getRoadmap shaping is done in the MCP server", () => {
	it.each([
		{ hideCompleted: true },
		{ rootId: "t3" },
		{ depth: 0 },
		{ depth: 1 },
		{ rootId: "p1", depth: 0 },
		{ rootId: "r", depth: 1, hideCompleted: true, omitNotes: true },
		{ rootId: "nope" },
	])("asks the app with no arguments for %j", async (args) => {
		const client = {
			request: vi.fn().mockResolvedValue(structuredClone(tree)),
		};
		await getRoadmapCallback(client)(args);
		expect(client.request).toHaveBeenCalledTimes(1);
		expect(client.request).toHaveBeenCalledWith("getRoadmap", {});
	});

	it.each([
		{},
		{ hideCompleted: false },
	])("returns the app's answer byte for byte for %j", async (args) => {
		const { text } = await run(args);
		expect(text).toBe(JSON.stringify(tree));
	});

	it("passes a non-object result through unchanged", async () => {
		const client = { request: vi.fn().mockResolvedValue(undefined) };
		const out = await getRoadmapCallback(client)({
			rootId: "r",
			depth: 0,
			hideCompleted: true,
		});
		expect(out.isError).toBeUndefined();
		expect(out.content[0].text).toBeUndefined();
	});

	it("passes an app error through unchanged", async () => {
		const client = {
			request: vi.fn().mockRejectedValue({
				code: "no_file_loaded",
				message: "No file loaded.",
			}),
		};
		const out = await getRoadmapCallback(client)({ hideCompleted: true });
		expect(out.isError).toBe(true);
		expect(out.content[0].text).toBe("Error (no_file_loaded): No file loaded.");
	});
});
