import { expect, test } from "claude-code/testing";

const roadmap = {
	revision: 1,
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
						status: "not-started",
						type: "uat",
						notes: "Open the app\nmore",
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
		expect(await ui.find({ text: /Login works/ })).toBeDefined();
		expect(await ui.find({ text: /Already accepted/ })).toBeUndefined();
		if (surface === "terminal") {
			await ui.press({ key: "pass-u1" });
			await ui.press({ key: "fail-u3" });
			await ui.input({ key: "why-u3", text: "button does nothing" });
			expect(writes).toEqual([]);
			await ui.press({ key: "uat-submit" });
		}
	}

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
