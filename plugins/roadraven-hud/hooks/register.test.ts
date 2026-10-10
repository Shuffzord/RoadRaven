import type { On } from "claude-code";
import { type Engine, expect, mock, test } from "claude-code/testing";

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
						id: "p1",
						title: "Search phase",
						status: "in-progress",
						children: [
							{ id: "t1", title: "Index", status: "completed" },
							{
								id: "u5",
								title: "Search works",
								status: "in-progress",
								type: "uat",
							},
						],
					},
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
		if (e.tool === "updateNodes" || e.tool === "updateNodeNotes")
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
			await ui.find({ text: /◆ awaiting UAT · 1 check\(s\)/ }),
		).toBeDefined();
		expect(
			await ui.find({ text: /1 active · 1 awaiting UAT · 3 UAT · 1 backlog/ }),
		).toBeDefined();
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
		seenUat: ["u5", "u1"],
	});
	expect(writes).toEqual([
		{
			tool: "updateNodes",
			expectedRevision: 1,
			updates: [
				{ nodeId: "u1", status: "completed", metadata: { uat: "pass" } },
				{ nodeId: "u3", status: "blocked", metadata: { uat: "fail" } },
			],
		},
		{
			tool: "updateNodeNotes",
			nodeId: "u3",
			mode: "append",
			notes: expect.stringContaining("button does nothing"),
		},
	]);
});

test("a server that isn't connected yet reads as connecting, and Retry asks again", async ($, on) => {
	let asks = 0;
	on("mcp.call", (_$, e) => {
		if (e.tool === "getRoadmap") asks++;
		const text = `$.mcp.call: no connected MCP tool "${e.tool}"`;
		return { value: { content: [{ type: "text", text }], isError: true } };
	});
	on("ui.open", () => ({ value: { isPlaced: true } }));
	on("ui.status", () => ({ value: undefined }));

	await $.command.run({ command: "roadraven", args: "" } as never);
	const ui = await $.ui.mount({
		plugin: "roadraven-hud",
		surface: "terminal",
		component: "Pane",
		requestId: "roadraven",
		props: { title: "RoadRaven", isFocused: true, bodyColumns: 80 } as never,
	});
	expect(await ui.find({ text: /Connecting to RoadRaven…/ })).toBeDefined();
	expect(await ui.find({ text: /no connected MCP tool/ })).toBeUndefined();
	const before = asks;
	await ui.press({ key: "rr-retry" });
	expect(asks).toBeGreaterThan(before);
});

// --- the write paths ------------------------------------------------------------------------------

type Call = { server: string; tool: string; args: Record<string, unknown> };
// An answer per call: a string is the tool's text, an Error its error text.
type Answer = (c: Call) => string | Error;

const answerOk: Answer = (c) =>
	c.tool === "getRoadmap" ? JSON.stringify(roadmap) : '{"ok":true}';

function rig(on: On, answer: { current: Answer }) {
	const calls: Call[] = [];
	const opens: unknown[] = [];
	const prompts: string[] = [];
	const toasts: string[] = [];
	on("mcp.call", (_$, e) => {
		calls.push({ server: e.server, tool: e.tool, args: e.args });
		const r = answer.current({ server: e.server, tool: e.tool, args: e.args });
		const isError = r instanceof Error;
		const text = isError ? r.message : r;
		return { value: { content: [{ type: "text", text }], isError } };
	});
	on("ui.open", (_$, e) => {
		opens.push(e);
		return { value: { isPlaced: true } };
	});
	on("ui.status", () => ({ value: undefined }));
	on("ui.toast", (_$, e) => {
		toasts.push(e.text);
		return { value: undefined };
	});
	on("prompt.submit", (_$, e) => {
		prompts.push(e.text);
		return { text: e.text };
	});
	mock.store(on);
	const writes = (tool: string) => calls.filter((c) => c.tool === tool);
	return { calls, opens, prompts, toasts, writes };
}

const PANE_PROPS = {
	plugin: "roadraven-hud",
	surface: "terminal",
	component: "Pane",
	requestId: "roadraven",
	props: { title: "RoadRaven", isFocused: true, bodyColumns: 80 } as never,
} as const;

const withStatus = (id: string, status: string) =>
	JSON.parse(
		JSON.stringify(roadmap).replace(
			new RegExp(`("id":"${id}"[^}]*?"status":")[a-z-]+`),
			`$1${status}`,
		),
	);

test("callRR moves to the second server only when the first isn't connected", async ($, on) => {
	const answer = {
		current: ((c) =>
			c.server === "roadraven"
				? new Error(`$.mcp.call: no connected MCP tool "${c.tool}"`)
				: answerOk(c)) as Answer,
	};
	const r = rig(on, answer);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.writes("getRoadmap").map((c) => c.server)).toEqual([
		"roadraven",
		"plugin:roadraven:roadraven",
	]);

	r.calls.length = 0;
	answer.current = () =>
		new Error("Error (app_not_running): RoadRaven is not running.");
	const ui = await $.ui.mount(PANE_PROPS);
	await ui.press({ key: "rr-retry" }).catch(() => undefined);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.calls.every((c) => c.server === "roadraven")).toBe(true);
});

async function markAndSend($: Engine, presses: string[]) {
	await $.command.run({ command: "roadraven", args: "" } as never);
	const ui = await $.ui.mount(PANE_PROPS);
	for (const key of presses) await ui.press({ key });
	return ui;
}

test("a double Send writes once", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const ui = await markAndSend($, ["pass-u1"]);
	await Promise.all([
		ui.press({ key: "uat-submit" }),
		ui.press({ key: "uat-submit" }),
	]);
	expect(r.writes("updateNodes")).toHaveLength(1);
	expect(r.prompts).toHaveLength(1);
});

test("Send re-reads the roadmap and skips a node no longer ready", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const ui = await markAndSend($, ["pass-u1", "pass-u3"]);
	const moved = withStatus("u3", "completed");
	answer.current = (c) =>
		c.tool === "getRoadmap"
			? JSON.stringify({ ...moved, revision: 7 })
			: '{"ok":true}';
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodes").map((c) => c.args)).toEqual([
		{
			expectedRevision: 7,
			updates: [
				{ nodeId: "u1", status: "completed", metadata: { uat: "pass" } },
			],
		},
	]);
	expect(r.writes("updateNodeStatus")).toEqual([]);
	expect(r.prompts[0]).toContain(
		'skipped: "Export works" (u3), no longer ready',
	);
});

test("a failed note still tells the orchestrator what was written, and a retry appends only the rest", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const session = mock.session(on);
	const ui = await markAndSend($, ["fail-u1", "fail-u3"]);
	await ui.input({ key: "why-u1", text: "login hangs" });
	await ui.input({ key: "why-u3", text: "file is empty again" });
	answer.current = (c) =>
		c.tool === "updateNodeNotes" && c.args.nodeId === "u3"
			? new Error("Error (internal): disk full")
			: answerOk(c);
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodes")).toHaveLength(1);
	expect(r.prompts).toEqual([]);
	const told = JSON.stringify(session.appended());
	expect(told).toContain("Login works");
	expect(told).toContain("could not be appended");
	expect(r.toasts.some((t) => /couldn't send UAT decisions/.test(t))).toBe(
		true,
	);

	answer.current = answerOk;
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodeNotes").map((c) => c.args.nodeId)).toEqual([
		"u1",
		"u3",
		"u3",
	]);
	expect(r.prompts).toHaveLength(1);
});

test("Run asks first, and won't start a second agent", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const spawns: unknown[] = [];
	let release: () => void = () => undefined;
	const gate = new Promise<void>((done) => {
		release = done;
	});
	let spawned: () => void = () => undefined;
	const didSpawn = new Promise<void>((done) => {
		spawned = done;
	});
	// A hook can't hand back an agentId (core sets it), so the spawn is held to watch it start.
	on("agent.spawn", async (_$, e) => {
		spawns.push(e);
		spawned();
		await gate;
		return { model: "claude-haiku-5-5" };
	});
	const ui = await markAndSend($, ["backlog-toggle", "run-root"]);
	expect(await ui.find({ text: /Start an agent on Root/ })).toBeDefined();
	expect(spawns).toEqual([]);
	const started = ui.press({ key: "run-start-root" });
	await didSpawn;
	expect(await ui.find({ text: /running/ })).toBeDefined();
	await expect(ui.press({ key: "run-root" })).rejects.toBeDefined();
	release();
	await started;
	expect(spawns).toHaveLength(1);
	expect(r.writes("getRoadmap").length).toBeGreaterThan(1);
});

test("the pane opens by itself only once RoadRaven answers with a roadmap", async ($, on) => {
	const clock = mock.clock(on);
	const answer = {
		current: (() =>
			new Error(
				"Error (app_not_running): RoadRaven is not running.",
			)) as Answer,
	};
	const r = rig(on, answer);
	on("command.register", () => ({ value: { command: "roadraven" } }));
	on("session.start", (_$, e) => ({ cwd: e.cwd }));
	await $.session.start({
		cwd: "/work",
		surface: "terminal",
		isInteractive: true,
	} as never);
	await clock.advance(8000);
	expect(r.writes("getRoadmap").length).toBeGreaterThan(0);
	expect(r.opens).toEqual([]);
	answer.current = answerOk;
	await clock.advance(4000);
	await clock.advance(4000);
	expect(r.opens).toHaveLength(1);
});
