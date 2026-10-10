import { expect, test } from "claude-code/testing";

const STORE_KEY = "attribution:/work/plan.roadraven.json";
// Attribution a previous session left behind: the agent that worked n1.
const saved = {
	agents: {
		a1: {
			id: "a1",
			label: "auth-worker",
			type: "general-purpose",
			model: "claude-haiku-5-5",
			effort: "low",
			startedAt: 0,
			isDone: false,
		},
	},
	owners: { n1: "a1" },
	seenUat: [],
};

const roadmap = {
	revision: 1,
	filePath: "/work/plan.roadraven.json",
	schema: {
		nodes: [
			{
				id: "root",
				title: "Root",
				status: "not-started",
				children: [
					{ id: "n1", title: "Wire auth", status: "in-progress", type: "task" },
					{
						id: "u1",
						title: "Login works",
						status: "in-progress",
						type: "uat",
						notes: "Open the app\n**Then** log in",
					},
					{
						id: "u2",
						title: "Already accepted",
						status: "completed",
						type: "UAT",
					},
					{
						id: "u3",
						title: "Export works",
						status: "blocked",
						type: "uat",
						notes:
							"Click Export\n\n**UAT failed** (2026-10-01): old reason\n\n**UAT failed** (2026-10-09): file is empty",
					},
					{
						id: "u4",
						title: "Not built yet",
						status: "not-started",
						type: "uat",
					},
				],
			},
		],
	},
};

test("pane lists active work and pending UAT; batched Pass is written on Send", async ($, on) => {
	const writes: Record<string, unknown>[] = [];
	on("mcp.call", (_$, e) => {
		if (e.tool === "updateNodeStatus" || e.tool === "updateNodeNotes")
			writes.push({ tool: e.tool, ...e.args });
		const text =
			e.tool === "getRoadmap" ? JSON.stringify(roadmap) : '{"ok":true}';
		return { value: { content: [{ type: "text", text }], isError: false } };
	});
	on("ui.open", () => ({ value: { isPlaced: true } }));
	on("ui.status", () => ({ value: undefined }));
	const prompts: string[] = [];
	on("prompt.submit", (_$, e) => {
		prompts.push(e.text);
		return { text: e.text };
	});
	const stored: Record<string, unknown> = { [STORE_KEY]: saved };
	on("store.get", (_$, e) => ({ value: stored[e.key] }));
	on("store.set", (_$, e) => {
		stored[e.key] = e.value;
		return { value: undefined };
	});

	await $.command.run({ command: "roadraven", args: "" } as never);

	for (const surface of ["terminal", "desktop"] as const) {
		const ui = await $.ui.mount({
			plugin: "roadraven-hud",
			surface,
			component: "Pane",
			requestId: "roadraven",
			props: { title: "RoadRaven", isFocused: true, bodyColumns: 80 } as never,
		});
		expect(await ui.find({ text: /Wire auth/ })).toBeDefined();
		expect(await ui.find({ text: /auth-worker/ })).toBeDefined();
		expect(await ui.find({ text: /done/ })).toBeDefined();
		expect(await ui.find({ text: /Login works/ })).toBeDefined();
		expect(await ui.find({ text: /Already accepted/ })).toBeUndefined();
		expect(await ui.find({ text: /Not built yet/ })).toBeUndefined();
		expect(
			await ui.find({ text: /✗ failed \(2026-10-09\): file is empty/ }),
		).toBeDefined();
		expect(await ui.find({ text: /failed before/ })).toBeUndefined();
		expect(await ui.find({ text: /1 not ready yet/ })).toBeDefined();
		if (surface === "terminal") {
			await ui.press({ key: "notes-u1" });
			expect(await ui.find({ text: /Then\*\* log in/ })).toBeDefined();
			await ui.press({ key: "pass-u1" });
			await ui.press({ key: "fail-u3" });
			await ui.input({ key: "why-u3", text: "button does nothing" });
			expect(
				await ui.find({ type: "Text", text: /button does nothing ✓ saved/ }),
			).toBeDefined();
			expect(writes).toEqual([]);
			await ui.press({ key: "uat-submit" });
			expect(
				await ui.find({
					text: /✓ Sent 2 decision\(s\) at \d\d:\d\d — the orchestrator is on it/,
				}),
			).toBeDefined();
			expect(prompts).toEqual([
				expect.stringContaining("[RoadRaven pane] The user reviewed 2 UAT"),
			]);
		}
	}

	expect(stored[STORE_KEY]).toMatchObject({
		owners: { n1: "a1" },
		seenUat: ["u1"],
	});
	expect(writes).toEqual([
		{
			tool: "updateNodeStatus",
			nodeId: "u1",
			status: "completed",
			meta: { uat: "pass" },
		},
		{
			tool: "updateNodeStatus",
			nodeId: "u3",
			status: "blocked",
			meta: { uat: "fail" },
		},
		{
			tool: "updateNodeNotes",
			nodeId: "u3",
			mode: "append",
			notes: expect.stringContaining("button does nothing"),
		},
	]);
});
