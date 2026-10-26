import type { On } from "claude-code";
import {
	type Engine,
	expect,
	type Mounted,
	mock,
	test,
} from "claude-code/testing";
import { barKey, EASE_MS } from "./bar";
import { MARK_MIN_COLUMNS } from "./draw";
import { CHOICE } from "./plan";
import { MARK_CYCLE_MS, MARK_KEY, MARK_MODE, MARK_TICK_MS } from "./raven-mark";
import { SPINNER, SPINNER_VERBS, TITLE_MAX } from "./spinner";

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
				notes: "Root brief\nsecond line",
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
		const text = answerRR(e);
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
		expect(await ui.find({ text: /Open the app/ })).toBeDefined();
		expect(await ui.find({ text: /Already accepted/ })).toBeUndefined();
		expect(await ui.find({ text: /Not built yet/ })).toBeUndefined();
		expect(
			await ui.find({ text: /◆ awaiting UAT · 1 check\(s\)/ }),
		).toBeDefined();
		expect(
			await ui.find({ text: /1 active · 1 awaiting UAT · 2 UAT · 1 backlog/ }),
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
			await ui.press({ key: "fail-u5" });
			await ui.input({ key: "why-u5", text: "button does nothing" });
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
				{ nodeId: "u5", status: "blocked", metadata: { uat: "fail" } },
				{ nodeId: "u1", status: "completed", metadata: { uat: "pass" } },
			],
		},
		{
			tool: "updateNodeNotes",
			nodeId: "u5",
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

// What RoadRaven answers: getRoadmap leaves notes out on omitNotes; findNodes and getNode carry them.
type N = { id: string; type?: string; notes?: string; children?: N[] };
const strip = ({ notes: _, children, ...rest }: N): N =>
	children ? { ...rest, children: children.map(strip) } : rest;
const walk = (list: N[]): N[] =>
	list.flatMap((n) => [n, ...walk(n.children ?? [])]);
type Rm = { schema: { nodes: N[] } };
type Q = { tool: string; args: Record<string, unknown> };
const ANSWERS: Record<string, (c: Q, rm: Rm) => unknown> = {
	getRoadmap: (c, rm) =>
		c.args.omitNotes
			? { ...rm, schema: { ...rm.schema, nodes: rm.schema.nodes.map(strip) } }
			: rm,
	findNodes: (c, rm) => ({
		nodes: walk(rm.schema.nodes)
			.filter((n) => n.type === c.args.type)
			.map((node) => ({ node, parentId: null })),
	}),
	getNode: (c, rm) => ({
		node: walk(rm.schema.nodes).find((n) => n.id === c.args.nodeId),
	}),
};
function answerRR(c: Q, rm: Rm = roadmap) {
	return JSON.stringify(ANSWERS[c.tool]?.(c, rm) ?? { ok: true });
}

test("a roadmap over Claude Code's MCP output limit reads as too large, with Retry", async ($, on) => {
	on("mcp.call", () => {
		const text =
			"Error: result (65,329 characters across 795 lines) exceeds maximum allowed tokens. Output has been saved to /home/u/.claude/projects/x/tool-results/mcp-roadraven-getRoadmap-1.txt.";
		return { value: { content: [{ type: "text", text }], isError: false } };
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
	expect(await ui.find({ text: /too large for Claude Code/ })).toBeDefined();
	expect(await ui.find({ text: /JSON Parse/ })).toBeUndefined();
	expect(await ui.find({ key: "rr-retry" })).toBeDefined();
});

// --- the write paths ------------------------------------------------------------------------------

type Call = { server: string; tool: string; args: Record<string, unknown> };
// An answer per call: a string is the tool's text, an Error its error text, `hang()` no answer ever.
type Answer = (c: Call) => string | Error | Promise<never>;

const answerOk: Answer = (c) => answerRR(c);

function rig(on: On, answer: { current: Answer }) {
	const calls: Call[] = [];
	const opens: unknown[] = [];
	const prompts: string[] = [];
	const toasts: string[] = [];
	const statuses: (string | undefined)[] = [];
	on("mcp.call", async (_$, e) => {
		calls.push({ server: e.server, tool: e.tool, args: e.args });
		const r = await answer.current({
			server: e.server,
			tool: e.tool,
			args: e.args,
		});
		const isError = r instanceof Error;
		const text = isError ? r.message : r;
		return { value: { content: [{ type: "text", text }], isError } };
	});
	on("ui.open", (_$, e) => {
		opens.push(e);
		return { value: { isPlaced: true } };
	});
	on("ui.status", (_$, e) => {
		statuses.push(e.text);
		return { value: undefined };
	});
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
	return { calls, opens, prompts, statuses, toasts, writes };
}

const PANE_PROPS = {
	plugin: "roadraven-hud",
	surface: "terminal",
	component: "Pane",
	requestId: "roadraven",
	props: { title: "RoadRaven", isFocused: true, bodyColumns: 80 } as never,
} as const;

// A status change, as the app answers it: with the next revision.
const withStatus = (id: string, status: string) => ({
	...JSON.parse(
		JSON.stringify(roadmap).replace(
			new RegExp(`("id":"${id}"[^}]*?"status":")[a-z-]+`),
			`$1${status}`,
		),
	),
	revision: roadmap.revision + 1,
});

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
	const ui = await markAndSend($, ["pass-u1", "pass-u5"]);
	const moved = withStatus("u5", "completed");
	answer.current = (c) => answerRR(c, { ...moved, revision: 7 });
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
		'skipped: "Search works" (u5), no longer ready',
	);
});

test("a failed note still tells the orchestrator what was written, and a retry appends only the rest", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const session = mock.session(on);
	const ui = await markAndSend($, ["fail-u1", "fail-u5"]);
	await ui.input({ key: "why-u1", text: "login hangs" });
	await ui.input({ key: "why-u5", text: "no results" });
	answer.current = (c) =>
		c.tool === "updateNodeNotes" && c.args.nodeId === "u1"
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
		"u5",
		"u1",
		"u1",
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
	expect(r.writes("getNode").map((c) => c.args)).toEqual([{ nodeId: "root" }]);
	expect(await ui.find({ text: /Root brief/ })).toBeDefined();
	expect(await ui.find({ text: /second line/ })).toBeUndefined();
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

test("polls ask for the tree without notes and fetch UAT notes with findNodes", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.writes("getRoadmap").map((c) => c.args)).toEqual([
		{ omitNotes: true },
	]);
	expect(r.writes("findNodes").map((c) => c.args.type)).toEqual(["uat", "UAT"]);
});

// Notes written to a node, as the app answers it: with the next revision.
const withNodeNotes = (id: string, notes: string) => {
	const next: Rm & { revision: number } = JSON.parse(JSON.stringify(roadmap));
	const node = walk(next.schema.nodes).find((n) => n.id === id);
	if (node) node.notes = notes;
	return { ...next, revision: roadmap.revision + 1 };
};

test("notes written to a UAT after it was created show on the next poll, from any session", async ($, on) => {
	const answer = { current: answerOk };
	rig(on, answer);
	await $.command.run({ command: "roadraven", args: "" } as never);
	const ui = await $.ui.mount(PANE_PROPS);
	expect(await ui.find({ key: "notes-u5" })).toBeUndefined();
	// Another session or a sub-agent fills the notes: no RoadRaven tool call runs in this one.
	const filled = withNodeNotes("u5", "Search for raven\n**Then** it is found");
	answer.current = (c) => answerRR(c, filled);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(await ui.find({ text: /Search for raven/ })).toBeDefined();
	await ui.press({ key: "notes-u5" });
	expect(await ui.find({ text: /Then\*\* it is found/ })).toBeDefined();
});

test("UAT notes are fetched again only when the roadmap revision changes", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	await $.command.run({ command: "roadraven", args: "" } as never);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.writes("findNodes")).toHaveLength(2); // one call per type spelling, one fetch
	const moved = withStatus("u5", "completed");
	answer.current = (c) => answerRR(c, moved);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.writes("findNodes")).toHaveLength(4);
});

test("a failing findNodes keeps the last notes drawn and logs once", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const logs: string[] = [];
	on("ui.log", (_$, e) => {
		logs.push(e.text);
		return { value: undefined };
	});
	await $.command.run({ command: "roadraven", args: "" } as never);
	const moved = withStatus("u5", "completed");
	answer.current = (c) =>
		c.tool === "findNodes"
			? new Error("Error (internal): boom")
			: answerRR(c, moved);
	await $.command.run({ command: "roadraven", args: "" } as never);
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.writes("findNodes").length).toBeGreaterThan(2);
	expect(logs.filter((t) => /couldn't fetch UAT notes/.test(t))).toHaveLength(
		1,
	);
	const ui = await $.ui.mount(PANE_PROPS);
	expect(await ui.find({ text: /Login works/ })).toBeDefined();
	await ui.press({ key: "notes-u1" });
	expect(await ui.find({ text: /Then\*\* log in/ })).toBeDefined();
});

test("a blocked UAT item waits for a fix: drawn as failed, not offered for Pass", async ($, on) => {
	rig(on, { current: answerOk });
	await $.command.run({ command: "roadraven", args: "" } as never);
	const ui = await $.ui.mount(PANE_PROPS);
	expect(await ui.find({ text: /Export works/ })).toBeDefined();
	expect(await ui.find({ text: /failed, waiting for a fix/ })).toBeDefined();
	expect(
		await ui.find({ text: /✗ failed \(2026-10-09\): file is empty/ }),
	).toBeDefined();
	expect(await ui.find({ key: "pass-u3" })).toBeUndefined();
	expect(await ui.find({ key: "fail-u3" })).toBeUndefined();
	expect(await ui.find({ key: "pass-u1" })).toBeDefined();
});

test("a UAT item sent back for a fix toasts again when it is ready for a re-test", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const run = () => $.command.run({ command: "roadraven", args: "" } as never);
	await run();
	expect(r.toasts.filter((t) => /UAT/.test(t))).toHaveLength(1);
	const failed = withStatus("u1", "blocked");
	answer.current = (c) => answerRR(c, failed);
	await run();
	answer.current = answerOk;
	await run();
	expect(r.toasts.filter((t) => /UAT ready: Login works/.test(t))).toHaveLength(
		1,
	);
	expect(r.toasts.filter((t) => /UAT/.test(t))).toHaveLength(2);
});

test("a node linked before RoadRaven first answers keeps its owner when the file's attribution loads", async ($, on) => {
	const answer = {
		current: (() =>
			new Error(
				"Error (app_not_running): RoadRaven is not running.",
			)) as Answer,
	};
	rig(on, answer);
	on("tool.call", () => ({ result: { content: [] } }) as never);
	on("agent.spawn", () => ({ model: "claude-haiku-5-5", agentId: "z1" }));
	await $.command.run({ command: "roadraven", args: "" } as never);
	await $.agent.spawn({
		prompt: "p",
		description: "early worker",
		name: "early-worker",
		subagentType: "general-purpose",
		parentModel: "claude-opus-5-5",
		tool_use_id: "t1",
	} as never);
	await $.tool.call({
		tool: "mcp__roadraven__updateNodeStatus",
		tool_use_id: "t2",
		agentId: "z1",
		nodeId: "n1",
		status: "in-progress",
	} as never);
	answer.current = answerOk;
	await $.command.run({ command: "roadraven", args: "" } as never);
	const ui = await $.ui.mount(PANE_PROPS);
	expect(await ui.find({ text: /early-worker/ })).toBeDefined();
	expect(await ui.find({ text: /auth-worker/ })).toBeUndefined();
});

test("owners of nodes no longer in the tree are dropped", async ($, on) => {
	const stored: Record<string, unknown> = {
		[STORE_KEY]: { ...saved, owners: { n1: "a1", gone: "a1" } },
	};
	on("mcp.call", (_$, e) => {
		const text = answerRR(e);
		return { value: { content: [{ type: "text", text }], isError: false } };
	});
	on("ui.open", () => ({ value: { isPlaced: true } }));
	on("ui.status", () => ({ value: undefined }));
	on("ui.toast", () => ({ value: undefined }));
	on("store.get", (_$, e) => ({ value: stored[e.key] }));
	on("store.set", (_$, e) => {
		stored[e.key] = e.value;
		return { value: undefined };
	});
	await $.command.run({ command: "roadraven", args: "" } as never);
	expect((stored[STORE_KEY] as { owners: unknown }).owners).toEqual({
		n1: "a1",
	});
});

// The app's settings folder on each platform, and the environment that names it.
const APP_DIRS: { dir: string; env: Record<string, string> }[] = [
	{
		dir: "C:/Users/u/AppData/Local/RoadRaven",
		env: {
			LOCALAPPDATA: "C:/Users/u/AppData/Local",
			USERPROFILE: "C:/Users/u",
		},
	},
	{
		dir: "/Users/u/Library/Application Support/RoadRaven",
		env: { HOME: "/Users/u" },
	},
	{ dir: "/home/u/.config/RoadRaven", env: { HOME: "/home/u" } },
	{ dir: "/xdg/RoadRaven", env: { HOME: "/home/u", XDG_CONFIG_HOME: "/xdg" } },
];

for (const { dir, env } of APP_DIRS)
	test(`follow-app reads the app's theme from ${dir}`, async ($, on) => {
		rig(on, { current: answerOk });
		mock.env(on, env);
		// The engine hands hooks host paths: on a POSIX host it roots C:/... at the plugin, on Windows
		// it resolves each path with backslashes. So paths are compared by their end, in `/` form.
		const endsWith = (path: string, end: string) =>
			path.replaceAll("\\", "/").endsWith(end);
		on("fs.exists", (_$, e) => ({ value: endsWith(e.path, dir) }));
		on("fs.read", (_$, e) => {
			if (endsWith(e.path, `${dir}/settings.json`))
				return { value: JSON.stringify({ theme: "probe" }) };
			if (endsWith(e.path, `${dir}/themes/probe.json`))
				return {
					value: JSON.stringify({ meta: { name: "Probe" }, colors: {} }),
				};
			return { deny: "no such file" };
		});
		await $.command.run({ command: "roadraven", args: "" } as never);
		const ui = await $.ui.mount(PANE_PROPS);
		expect(await ui.find({ text: /· Probe/ })).toBeDefined();
	});

test("↗ on an active, a UAT and a backlog row shows that node in RoadRaven", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const ui = await markAndSend($, ["backlog-toggle"]);
	for (const id of ["n1", "u1", "root"]) await ui.press({ key: `goto-${id}` });
	expect(r.writes("revealNode").map((c) => c.args)).toEqual([
		{ nodeId: "n1" },
		{ nodeId: "u1" },
		{ nodeId: "root" },
	]);
	expect(r.toasts).toEqual([expect.stringContaining("UAT items ready")]);
});

test("↗ against a plugin without revealNode says to update the plugin", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const ui = await markAndSend($, []);
	answer.current = (c) =>
		c.tool === "revealNode"
			? new Error(`$.mcp.call: no connected MCP tool "${c.tool}"`)
			: answerOk(c);
	await ui.press({ key: "goto-n1" });
	expect(r.toasts.at(-1)).toMatch(/update the RoadRaven plugin/);
	expect(await ui.find({ text: /Connecting to RoadRaven/ })).toBeUndefined();
});

test("↗ against an app without revealNode says to update the app", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const ui = await markAndSend($, []);
	answer.current = (c) =>
		c.tool === "revealNode"
			? new Error(
					"Error (unknown_tool): Unknown agent tool: 'revealNode'. Update the plugin to a version that matches the app.",
				)
			: answerOk(c);
	await ui.press({ key: "goto-n1" });
	expect(r.toasts.at(-1)).toMatch(/update the RoadRaven app/);
});

test("Next marks a not-started node next and tells the session", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const session = mock.session(on);
	await markAndSend($, ["backlog-toggle", "next-root"]);
	expect(r.writes("updateNodes").map((c) => c.args)).toEqual([
		{
			expectedRevision: 1,
			updates: [{ nodeId: "root", metadata: { priority: "next" } }],
		},
	]);
	expect(JSON.stringify(session.appended())).toContain("prioritise node");
	expect(r.toasts).toContain("RoadRaven · Root marked next");
});

test("Next on a node that has started writes nothing and says so", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const ui = await markAndSend($, ["backlog-toggle"]);
	const moved = withStatus("root", "in-progress");
	answer.current = (c) => answerRR(c, moved);
	await ui.press({ key: "next-root" });
	expect(r.writes("updateNodes")).toEqual([]);
	expect(r.toasts).toContain(
		"RoadRaven · Root is no longer not-started; nothing done",
	);
});

test("Run that the session refuses starts nothing and says why", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const session = mock.session(on);
	on("agent.spawn", () => ({ deny: "agents are off here" }));
	await markAndSend($, ["backlog-toggle", "run-root", "run-start-root"]);
	expect(r.toasts).toContain(
		"RoadRaven · could not start an agent: agents are off here",
	);
	expect(session.appended()).toEqual([]);
});

test("Run on a node that has started since the confirm starts nothing", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const spawns: unknown[] = [];
	on("agent.spawn", (_$, e) => {
		spawns.push(e);
		return { deny: "unexpected" };
	});
	const ui = await markAndSend($, ["backlog-toggle", "run-root"]);
	const moved = withStatus("root", "in-progress");
	answer.current = (c) => answerRR(c, moved);
	await ui.press({ key: "run-start-root" });
	expect(spawns).toEqual([]);
	expect(r.toasts).toContain(
		"RoadRaven · Root is no longer not-started; nothing done",
	);
});

test("each roadmap file brings its own attribution back, and saves under its own key", async ($, on) => {
	const OTHER = "/work/other.json";
	const otherKey = `attribution:${OTHER}`;
	const stored: Record<string, unknown> = {
		[STORE_KEY]: saved,
		[otherKey]: {
			agents: { b1: { ...saved.agents.a1, id: "b1", label: "other-worker" } },
			owners: { n1: "b1" },
			seenUat: [],
		},
	};
	const other = { ...roadmap, filePath: OTHER };
	let rm = roadmap;
	on("mcp.call", (_$, e) => {
		const text = answerRR(e, rm);
		return { value: { content: [{ type: "text", text }], isError: false } };
	});
	on("ui.open", () => ({ value: { isPlaced: true } }));
	on("ui.status", () => ({ value: undefined }));
	on("ui.toast", () => ({ value: undefined }));
	on("store.get", (_$, e) => ({ value: stored[e.key] }));
	on("store.set", (_$, e) => {
		stored[e.key] = e.value;
		return { value: undefined };
	});
	const open = () => $.command.run({ command: "roadraven", args: "" } as never);

	await open();
	const ui = await $.ui.mount(PANE_PROPS);
	expect(await ui.find({ text: /auth-worker/ })).toBeDefined();
	rm = other;
	await open();
	expect(await ui.find({ text: /other-worker/ })).toBeDefined();
	expect(await ui.find({ text: /auth-worker/ })).toBeUndefined();
	expect(stored[otherKey]).toMatchObject({
		owners: { n1: "b1" },
		seenUat: ["u5", "u1"],
	});
	rm = roadmap;
	await open();
	expect(await ui.find({ text: /auth-worker/ })).toBeDefined();
	expect(stored[STORE_KEY]).toMatchObject({
		owners: { n1: "a1" },
		seenUat: ["u5", "u1"],
	});
});

test("an untitled roadmap leaves the previous file's saved attribution alone", async ($, on) => {
	const stored: Record<string, unknown> = { [STORE_KEY]: saved };
	// The app answers an untitled roadmap with no file path.
	const untitled = {
		revision: 9,
		filePath: null,
		isUntitled: true,
		schema: { nodes: [{ id: "x", title: "Scratch", status: "not-started" }] },
	};
	let rm: Rm = roadmap;
	on("mcp.call", (_$, e) => {
		const text = answerRR(e, rm);
		return { value: { content: [{ type: "text", text }], isError: false } };
	});
	on("ui.open", () => ({ value: { isPlaced: true } }));
	on("ui.status", () => ({ value: undefined }));
	const toasts: string[] = [];
	on("ui.toast", (_$, e) => {
		toasts.push(e.text);
		return { value: undefined };
	});
	on("store.get", (_$, e) => ({ value: stored[e.key] }));
	on("store.set", (_$, e) => {
		stored[e.key] = e.value;
		return { value: undefined };
	});
	const open = () => $.command.run({ command: "roadraven", args: "" } as never);

	await open();
	const ofA = JSON.stringify(stored[STORE_KEY]);
	rm = untitled;
	await open();
	const ui = await $.ui.mount(PANE_PROPS);
	expect(await ui.find({ text: /Scratch/ })).toBeDefined();
	expect(JSON.stringify(stored[STORE_KEY])).toBe(ofA);
	rm = roadmap;
	await open();
	expect(JSON.stringify(stored[STORE_KEY])).toBe(ofA);
	expect(await ui.find({ text: /auth-worker/ })).toBeDefined();
	expect(toasts.filter((t) => /UAT/.test(t))).toHaveLength(1);
});

// The test environment has timers; its typings (no DOM lib) do not name them.
const later = (
	globalThis as unknown as {
		setTimeout: (fn: () => void, ms: number) => void;
	}
).setTimeout;

test("refreshes run one at a time; one asked for meanwhile runs once after", async ($, on) => {
	let inFlight = 0;
	let most = 0;
	let reads = 0;
	let release: () => void = () => undefined;
	const gate = new Promise<void>((done) => {
		release = done;
	});
	on("mcp.call", async (_$, e) => {
		if (e.tool === "getRoadmap") {
			reads++;
			inFlight++;
			most = Math.max(most, inFlight);
			await gate;
			inFlight--;
		}
		const text = answerRR(e);
		return { value: { content: [{ type: "text", text }], isError: false } };
	});
	on("ui.open", () => ({ value: { isPlaced: true } }));
	on("ui.status", () => ({ value: undefined }));
	on("ui.toast", () => ({ value: undefined }));
	mock.store(on);
	const run = () => $.command.run({ command: "roadraven", args: "" } as never);
	const first = run();
	const more = [run(), run()];
	// Long enough for every refresh asked for to reach getRoadmap if nothing holds it back.
	await new Promise<void>((done) => later(done, 50));
	release();
	await Promise.all([first, ...more]);
	expect(most).toBe(1);
	expect(reads).toBe(2);
});

// A reload (a theme change, /reload-plugins, a respawned hooks worker) drops the old environment and
// cancels its waits, so work it had in flight never settles; the kit has no reload, so a wait that
// never settles stands in for the cancelled one, and the fresh load's session.start is raised again.
function hang() {
	let reached: () => void = () => undefined;
	const isReached = new Promise<void>((done) => {
		reached = done;
	});
	const never = () => {
		reached();
		return new Promise<never>(() => undefined);
	};
	return { never, isReached };
}

function sessions($: Engine, on: On) {
	mock.clock(on);
	on("command.register", () => ({ value: { command: "roadraven" } }));
	on("session.start", (_$, e) => ({ cwd: e.cwd }));
	return () =>
		$.session.start({
			cwd: "/work",
			surface: "terminal",
			isInteractive: true,
		} as never);
}

test("a session start clears a refresh the previous load left in flight", async ($, on) => {
	const stall = hang();
	const answer = { current: (() => stall.never()) as Answer };
	const r = rig(on, answer);
	const start = sessions($, on);
	void $.command.run({ command: "roadraven", args: "" } as never);
	await stall.isReached;
	answer.current = answerOk;
	await start();
	for (let i = 0; i < 3; i++)
		await $.command.run({ command: "roadraven", args: "" } as never);
	expect(r.writes("getRoadmap").length).toBeGreaterThan(1);
});

test("a session start clears a Send the previous load left in flight", async ($, on) => {
	const stall = hang();
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const start = sessions($, on);
	const ui = await markAndSend($, ["pass-u1"]);
	answer.current = (c) =>
		c.tool === "updateNodes" ? stall.never() : answerOk(c);
	void ui.press({ key: "uat-submit" });
	await stall.isReached;
	answer.current = answerOk;
	await start();
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodes")).toHaveLength(2);
});

test("a session start clears a Run the previous load left in flight", async ($, on) => {
	const stall = hang();
	rig(on, { current: answerOk });
	const start = sessions($, on);
	const spawns: unknown[] = [];
	on("agent.spawn", (_$, e) => {
		spawns.push(e);
		return spawns.length === 1 ? stall.never() : { deny: "refused" };
	});
	const ui = await markAndSend($, ["backlog-toggle", "run-root"]);
	void ui.press({ key: "run-start-root" });
	await stall.isReached;
	await start();
	await ui.press({ key: "run-root" });
	await ui.press({ key: "run-start-root" });
	expect(spawns).toHaveLength(2);
});

test("an unchanged file and revision skips the snapshot work", async ($, on) => {
	const answer = { current: answerOk };
	const r = rig(on, answer);
	const run = () => $.command.run({ command: "roadraven", args: "" } as never);
	await run();
	await run();
	await run();
	expect(r.statuses.filter((t) => t !== undefined)).toHaveLength(1);
	const moved = withStatus("n1", "completed");
	answer.current = (c) => answerRR(c, moved);
	await run();
	expect(r.statuses.filter((t) => t !== undefined)).toHaveLength(2);
});

test("a Pass shows a note field; its note is appended and sent to the orchestrator", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const ui = await markAndSend($, []);
	expect(await ui.find({ key: "why-u1" })).toBeUndefined();
	await ui.press({ key: "pass-u1" });
	expect((await ui.find({ key: "why-u1" }))?.props.placeholder).toBe(
		CHOICE.pass.placeholder,
	);
	await ui.input({ key: "why-u1", text: "worked, but slow" });
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodeNotes").map((c) => c.args)).toEqual([
		{
			nodeId: "u1",
			mode: "append",
			notes: expect.stringMatching(
				/^\*\*UAT passed\*\* \(\d{4}-\d\d-\d\d\): worked, but slow$/,
			),
		},
	]);
	expect(r.prompts[0]).toContain('PASS: "Login works" (u1) — worked, but slow');
});

test("Pass then Fail keeps the typed note and writes it as the fail line", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const ui = await markAndSend($, ["pass-u1"]);
	await ui.input({ key: "why-u1", text: "login hangs" });
	await ui.press({ key: "fail-u1" });
	expect((await ui.find({ key: "why-u1" }))?.props.placeholder).toBe(
		CHOICE.fail.placeholder,
	);
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodeNotes").map((c) => c.args.notes)).toEqual([
		expect.stringMatching(
			/^\*\*UAT failed\*\* \(\d{4}-\d\d-\d\d\): login hangs$/,
		),
	]);
	expect(r.prompts[0]).toContain('FAIL: "Login works" (u1) — login hangs');
});

test("a Pass without a note appends nothing to the node's notes", async ($, on) => {
	const r = rig(on, { current: answerOk });
	const ui = await markAndSend($, ["pass-u1"]);
	await ui.press({ key: "uat-submit" });
	expect(r.writes("updateNodes")).toHaveLength(1);
	expect(r.writes("updateNodeNotes")).toEqual([]);
});

// --- the raven mark and the progress bars -------------------------------------------------------

const SURFACES = ["terminal", "desktop"] as const;
const paneOn = (surface: (typeof SURFACES)[number], bodyColumns = 80) => ({
	...PANE_PROPS,
	surface,
	props: { title: "RoadRaven", isFocused: true, bodyColumns } as never,
});
type PaneUi = Mounted<(typeof SURFACES)[number], "Pane">;
const open = ($: Engine) =>
	$.command.run({ command: "roadraven", args: "" } as never);

test("the header holds the raven mark: animated by default, livelier while an agent runs", async ($, on) => {
	rig(on, { current: answerOk });
	on("agent.spawn", () => ({ model: "claude-haiku-5-5", agentId: "z1" }));
	await open($);
	const uis: PaneUi[] = [];
	for (const surface of SURFACES) {
		const ui = await $.ui.mount(paneOn(surface));
		uis.push(ui);
		expect((await ui.find({ key: MARK_KEY }))?.props.props).toMatchObject({
			still: false,
			mode: MARK_MODE.IDLE,
		});
		const seen = new Set<string>();
		for (let t = 0; t < MARK_CYCLE_MS.idle; t += MARK_TICK_MS) {
			seen.add(JSON.stringify(await ui.drawn({ in: MARK_KEY })));
			await ui.advance(MARK_TICK_MS);
		}
		expect(seen.size).toBeGreaterThan(1);
	}
	await $.agent.spawn({
		prompt: "p",
		description: "worker",
		name: "worker",
		subagentType: "general-purpose",
		parentModel: "claude-opus-5-5",
		tool_use_id: "t1",
	} as never);
	for (const ui of uis)
		expect((await ui.find({ key: MARK_KEY }))?.props.props).toMatchObject({
			still: false,
			mode: MARK_MODE.BUSY,
		});
});

for (const setting of ["prefersReducedMotion", "axScreenReader"] as const)
	test(`${setting} draws the mark as one still frame`, async ($, on) => {
		rig(on, { current: answerOk });
		const start = sessions($, on);
		on("settings.read", () => ({ value: { [setting]: true } }));
		await start();
		await open($);
		for (const surface of SURFACES) {
			const ui = await $.ui.mount(paneOn(surface));
			expect((await ui.find({ key: MARK_KEY }))?.props.props).toMatchObject({
				still: true,
			});
			const before = JSON.stringify(await ui.drawn({ in: MARK_KEY }));
			for (let t = 0; t < MARK_CYCLE_MS.idle; t += MARK_TICK_MS) {
				await ui.advance(MARK_TICK_MS);
				expect(JSON.stringify(await ui.drawn({ in: MARK_KEY }))).toBe(before);
			}
		}
	});

test(`the mark hides below ${MARK_MIN_COLUMNS} columns rather than wrapping`, async ($, on) => {
	rig(on, { current: answerOk });
	await open($);
	for (const surface of SURFACES) {
		const ui = await $.ui.mount(paneOn(surface, MARK_MIN_COLUMNS - 1));
		expect(await ui.find({ key: MARK_KEY })).toBeUndefined();
		expect(await ui.find({ text: /RoadRaven/ })).toBeDefined();
		expect(await ui.find({ text: /1 active · 1 awaiting UAT/ })).toBeDefined();
		await ui.redraw(paneOn(surface, MARK_MIN_COLUMNS).props);
		expect(await ui.find({ key: MARK_KEY })).toBeDefined();
		expect(await ui.find({ text: /1 active · 1 awaiting UAT/ })).toBeDefined();
	}
});

const barText = async (ui: PaneUi) =>
	(await ui.find({ in: barKey("p1"), type: "Text" }))?.text;

test("an active node with children shows its progress bar; a leaf shows none", async ($, on) => {
	rig(on, { current: answerOk });
	await open($);
	for (const surface of SURFACES) {
		const ui = await $.ui.mount(paneOn(surface));
		expect(await barText(ui)).toBe("██████░░░░░░  50%  1/2");
		expect(await ui.find({ key: barKey("n1") })).toBeUndefined();
	}
});

// The pane drawn on both surfaces with p1 at 1/2, then u5 completed: p1 is 2/2.
async function completeP1($: Engine, on: On, isStill: boolean) {
	const answer = { current: answerOk };
	rig(on, answer);
	const start = sessions($, on);
	on("settings.read", () => ({ value: { prefersReducedMotion: isStill } }));
	await start();
	await open($);
	const uis: PaneUi[] = [];
	for (const surface of SURFACES) uis.push(await $.ui.mount(paneOn(surface)));
	const done = withStatus("u5", "completed");
	answer.current = (c) => answerRR(c, done);
	await open($);
	return uis;
}

const FULL_BAR = "████████████ 100%  2/2";
const fullCells = async (ui: PaneUi) =>
	[...((await barText(ui)) ?? "")].filter((ch) => ch === "█").length;

test(`a new done count eases the bar over ${EASE_MS} ms`, async ($, on) => {
	for (const ui of await completeP1($, on, false)) {
		expect(await barText(ui)).toBe("██████░░░░░░ 100%  2/2");
		await ui.advance(EASE_MS / 2);
		expect(await fullCells(ui)).toBeGreaterThan(6);
		expect(await fullCells(ui)).toBeLessThan(12);
		await ui.advance(EASE_MS);
		expect(await barText(ui)).toBe(FULL_BAR);
	}
});

test("a new done count jumps the bar under reduced motion", async ($, on) => {
	for (const ui of await completeP1($, on, true))
		expect(await barText(ui)).toBe(FULL_BAR);
});

// --- the opt-in raven spinner -------------------------------------------------------------------

const spinnerOn = (
	surface: (typeof SURFACES)[number],
	props: { word?: string; suffix?: string; mode?: string } = {},
) => ({
	plugin: "roadraven-hud",
	surface,
	component: "Spinner",
	requestId: "main",
	props: {
		word: "Sauteing",
		message: null,
		suffix: "…",
		mode: "thinking",
		...props,
	} as never,
});

// What the engine would draw: the props the plugins above it left in place.
function spinnerSeen(on: On) {
	const seen: Record<string, unknown>[] = [];
	on("ui.render", { component: "Spinner" }, (_$, e) => {
		seen.push({ ...e.props });
		return { type: "Text", props: {}, children: [] } as never;
	});
	return seen;
}

for (const surface of SURFACES) {
	test(
		`spinner classic leaves the props untouched on ${surface}`,
		{ options: { spinner: SPINNER.CLASSIC } },
		async ($, on) => {
			rig(on, { current: answerOk });
			const seen = spinnerSeen(on);
			await open($);
			await $.ui.mount(spinnerOn(surface));
			expect(seen.at(-1)).toEqual({
				word: "Sauteing",
				message: null,
				suffix: "…",
				mode: "thinking",
			});
		},
	);

	test(`spinner defaults to classic on ${surface}`, async ($, on) => {
		rig(on, { current: answerOk });
		const seen = spinnerSeen(on);
		await open($);
		await $.ui.mount(spinnerOn(surface));
		expect(seen.at(-1)?.word).toBe("Sauteing");
	});

	test(
		`spinner raven names the active node on ${surface}`,
		{ options: { spinner: SPINNER.RAVEN } },
		async ($, on) => {
			rig(on, { current: answerOk });
			const seen = spinnerSeen(on);
			await open($);
			await $.ui.mount(spinnerOn(surface, { mode: "tool-use" }));
			expect(seen.at(-1)).toMatchObject({
				word: SPINNER_VERBS["tool-use"],
				message: null,
				mode: "tool-use",
				suffix: "… · RR ▸ Wire auth",
			});
		},
	);

	test(
		`spinner raven keeps another mod's suffix on ${surface}`,
		{ options: { spinner: SPINNER.RAVEN } },
		async ($, on) => {
			rig(on, { current: answerOk });
			const seen = spinnerSeen(on);
			await open($);
			await $.ui.mount(spinnerOn(surface, { suffix: "… [other]" }));
			expect(String(seen.at(-1)?.suffix)).toBe("… [other] · RR ▸ Wire auth");
		},
	);

	test(
		`spinner raven truncates a long title on ${surface}`,
		{ options: { spinner: SPINNER.RAVEN } },
		async ($, on) => {
			const long = "A".repeat(TITLE_MAX + 20);
			const rm = JSON.parse(JSON.stringify(roadmap).replace("Wire auth", long));
			rig(on, { current: (c) => answerRR(c, rm) });
			const seen = spinnerSeen(on);
			await open($);
			await $.ui.mount(spinnerOn(surface));
			expect(String(seen.at(-1)?.suffix)).toBe(
				`… · RR ▸ ${"A".repeat(TITLE_MAX - 1)}…`,
			);
		},
	);

	test(
		`spinner raven with no active node says only RR on ${surface}`,
		{ options: { spinner: SPINNER.RAVEN } },
		async ($, on) => {
			const rm = JSON.parse(
				JSON.stringify(roadmap).replaceAll('"in-progress"', '"completed"'),
			);
			rig(on, { current: (c) => answerRR(c, rm) });
			const seen = spinnerSeen(on);
			await open($);
			await $.ui.mount(spinnerOn(surface));
			expect(seen.at(-1)?.suffix).toBe("… · RR");
		},
	);

	test(
		`spinner raven offline leaves the props untouched on ${surface}`,
		{ options: { spinner: SPINNER.RAVEN } },
		async ($, on) => {
			rig(on, {
				current: () =>
					new Error("Error (app_not_running): RoadRaven is not running."),
			});
			const seen = spinnerSeen(on);
			await open($).catch(() => undefined);
			await $.ui.mount(spinnerOn(surface));
			expect(seen.at(-1)).toEqual({
				word: "Sauteing",
				message: null,
				suffix: "…",
				mode: "thinking",
			});
		},
	);
}
