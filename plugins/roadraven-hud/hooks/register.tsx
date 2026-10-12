import type { EngineInterface, Register, ToolCallInput } from "claude-code";
import { atom, read, update } from "claude-code";

import type { HudAgent, HudError, HudNode, HudPalette } from "../types";
import {
	type Data,
	drawAgent,
	drawFixing,
	drawFullNotes,
	drawHeader,
	drawSaved,
	drawSent,
	drawUatTitle,
	drawUnowned,
	hasMoreNotes,
	isBusy,
	notReady,
	pill,
	quiet,
	type View,
} from "./draw";
import {
	brief,
	CHOICE,
	type Decision,
	decisionLine,
	errText,
	framed,
	goneToast,
	inTree,
	isNotStarted,
	itemNote,
	keptAgents,
	mergeOwners,
	nextPlan,
	plainError,
	q,
	revealFailure,
	reviewedText,
	running,
	type Saved,
	type SendPlan,
	sendPlan,
	skippedLine,
	skippedToast,
	storeKey,
	textOf,
	toAgent,
	tokensOf,
	type Update,
	uatNoteLine,
	uatToast,
} from "./plan";
import {
	CONN,
	cleanNotes,
	codeOf,
	connKind,
	describeAction,
	flatten,
	isFixingUat,
	isReadyUat,
	isUat,
	notesById,
	parseReply,
	type RawNode,
	roadmapTitle,
	shownKind,
	uatSig,
	uatTypes,
	withNotes,
	workCounts,
} from "./roadmap";
import { AMBER, toPalette } from "./theme";

const PANE = "roadraven";
const POLL_MS = 4000;
const SLOW_POLL_MS = 30_000;
const BACKOFF_AFTER_MS = 60_000;
const STARTING_MS = 15_000;
const BACKLOG_MAX = 12;
// The server is `roadraven` when configured by hand, `plugin:roadraven:roadraven` when the plugin ships it.
const SERVERS = ["roadraven", "plugin:roadraven:roadraven"];
const RR_TOOL = /^mcp__(plugin_roadraven_)?roadraven__/;

const S = { plugin: "roadraven-hud" } as const;
const agents = atom({ ...S, key: "agents" } as const, {});
const owners = atom({ ...S, key: "owners" } as const, {});
const activity = atom({ ...S, key: "activity" } as const, {});
const snapshot = atom({ ...S, key: "snapshot" } as const, {
	title: "",
	nodes: [],
});
const error = atom({ ...S, key: "error" } as const, null);
const startedAt = atom({ ...S, key: "startedAt" } as const, 0);
const palette = atom({ ...S, key: "palette" } as const, AMBER);
const decisions = atom({ ...S, key: "decisions" } as const, {});
const note = atom({ ...S, key: "note" } as const, "");
const itemNotes = atom({ ...S, key: "itemNotes" } as const, {});
const showBacklog = atom({ ...S, key: "showBacklog" } as const, false);
const seenUat = atom({ ...S, key: "seenUat" } as const, []);
const sent = atom({ ...S, key: "sent" } as const, null);
const openNotes = atom({ ...S, key: "openNotes" } as const, {});
// The roadmap whose attribution the atoms hold; "" until the first refresh, or while untitled.
const roadmapPath = atom({ ...S, key: "roadmapPath" } as const, "");
const isSending = atom({ ...S, key: "isSending" } as const, false);
// The backlog node whose Run waits for its confirm; "" for none.
const confirmRun = atom({ ...S, key: "confirmRun" } as const, "");
// The first line of that node's notes, fetched when Run is pressed (polls carry no notes).
const runNotes = atom({ ...S, key: "runNotes" } as const, "");
const starting = atom({ ...S, key: "starting" } as const, {});
const autoOpened = atom({ ...S, key: "autoOpened" } as const, false);
// When RoadRaven stopped answering (0 while it answers), and the last time it was asked.
const offlineSince = atom({ ...S, key: "offlineSince" } as const, 0);
const lastTry = atom({ ...S, key: "lastTry" } as const, 0);
const uatNotes = atom({ ...S, key: "uatNotes" } as const, {
	sig: null,
	notes: {},
	isFailing: false,
});
const refreshing = atom({ ...S, key: "refreshing" } as const, "idle");
// `filePath@revision` of the snapshot drawn; "" after a failed read, so the next answer is drawn.
const seenRevision = atom({ ...S, key: "seenRevision" } as const, "");

// --- RoadRaven and the session ---------------------------------------------------------------

async function callServer(
	$: EngineInterface,
	server: string,
	tool: string,
	args: Record<string, unknown>,
) {
	const r = await $.mcp.call(server, tool, args);
	const text = textOf(r);
	if (r.isError) throw new Error(text || `${tool} failed`);
	return parseReply(text);
}

async function callRR(
	$: EngineInterface,
	tool: string,
	args: Record<string, unknown> = {},
) {
	let last = "RoadRaven MCP server not connected";
	for (const server of SERVERS) {
		try {
			return await callServer($, server, tool, args);
		} catch (err) {
			// Only "not connected" moves on: both servers may reach the same app, so a real
			// answer (even a timeout after the write applied) must not be sent again.
			last = errText(err);
			if (connKind(last) !== "connecting") throw new Error(last);
		}
	}
	throw new Error(last);
}

// Polls and re-reads leave notes out: a large roadmap's notes exceed Claude Code's tool-result limit.
const LEAN = { omitNotes: true };

async function freshRead($: EngineInterface) {
	const { revision, schema = {} } = await callRR($, "getRoadmap", LEAN);
	return {
		revision: revision as number,
		nodes: flatten((schema.nodes ?? []) as RawNode[]),
	};
}

async function batchOnce<T extends { updates: Update[] }>(
	$: EngineInterface,
	plan: (nodes: HudNode[]) => T,
) {
	const { revision, nodes } = await freshRead($);
	const p = plan(nodes);
	if (p.updates.length > 0)
		await callRR($, "updateNodes", {
			updates: p.updates,
			expectedRevision: revision,
		});
	return p;
}

// One atomic updateNodes built from a fresh read; a stale revision re-reads and rebuilds it once.
async function batch<T extends { updates: Update[] }>(
	$: EngineInterface,
	plan: (nodes: HudNode[]) => T,
) {
	try {
		return await batchOnce($, plan);
	} catch (err) {
		if (codeOf(errText(err)) !== "stale_write") throw err;
		return batchOnce($, plan);
	}
}

// A user-role row the main session reads at its next turn; it starts no turn of its own.
function tell($: EngineInterface, text: string) {
	return $.session.append({
		message: { type: "user", content: [{ type: "text", text: framed(text) }] },
	});
}

// A prompt that starts its own turn once the session is idle; refused or failed, the quiet append.
async function wake($: EngineInterface, text: string) {
	const r = await $.prompt
		.submit({ text: framed(text) })
		.catch(() => undefined);
	if (r && !r.drop) return true;
	await tell($, text);
	return false;
}

async function homeDir($: EngineInterface) {
	return (await $.env.get("HOME")) ?? (await $.env.get("USERPROFILE")) ?? "";
}

// Where the app keeps settings.json: Windows, macOS, then Linux (the fallback), as the app decides.
async function appConfigDirs($: EngineInterface) {
	const home = await homeDir($);
	const local = await $.env.get("LOCALAPPDATA");
	const xdg = (await $.env.get("XDG_CONFIG_HOME")) ?? `${home}/.config`;
	return [
		...(local ? [`${local}/RoadRaven`] : []),
		`${home}/Library/Application Support/RoadRaven`,
		`${xdg}/RoadRaven`,
	];
}

async function appConfigDir($: EngineInterface) {
	const dirs = await appConfigDirs($);
	for (const dir of dirs)
		if (await $.fs.exists(dir).catch(() => false)) return dir;
	return dirs[dirs.length - 1] ?? "";
}

// The app's theme id, or undefined while settings.json is mid-write (the app rewrites it in place).
async function appThemeId($: EngineInterface, dir: string) {
	try {
		return String(
			JSON.parse(await $.fs.read(`${dir}/settings.json`)).theme ?? "amber",
		);
	} catch {
		return undefined;
	}
}

async function themeFileId($: EngineInterface, choice: string, dir: string) {
	const id = choice === "follow-app" ? await appThemeId($, dir) : choice;
	// ponytail: the OS colour scheme is out of reach here, so `system` guesses dark.
	return id === "system" ? "dark" : id;
}

async function readTheme($: EngineInterface, path: string) {
	try {
		return toPalette(JSON.parse(await $.fs.read(path)));
	} catch {
		return undefined; // not this file: try the next one
	}
}

async function loadPalette(
	$: EngineInterface,
	choice: string,
): Promise<HudPalette | undefined> {
	const dir = await appConfigDir($);
	const id = await themeFileId($, choice, dir);
	if (!id) return undefined;
	for (const path of [
		`${$.plugin.root}/themes/${id}.json`,
		`${dir}/themes/${id}.json`,
	]) {
		const found = await readTheme($, path);
		if (found) return found;
	}
	return AMBER;
}

async function syncPalette($: EngineInterface, themeChoice: string) {
	const next = await loadPalette($, themeChoice).catch(() => undefined);
	if (next && JSON.stringify(next) !== JSON.stringify(await read($, palette)))
		await update($, palette, () => next);
}

// --- attribution kept across restarts, per roadmap file ------------------------------------------

async function saveAttribution($: EngineInterface) {
	const path = await read($, roadmapPath);
	if (!path) return;
	const saved: Saved = {
		agents: keptAgents(await read($, agents), false),
		owners: await read($, owners),
		seenUat: await read($, seenUat),
	};
	// Losing the saved attribution only costs the labels after a restart: never fail the pane on it.
	await $.store.set(storeKey(path), saved).catch(() => undefined);
}

async function loadAttribution($: EngineInterface, path: string) {
	const saved: Saved = {
		agents: {},
		owners: {},
		seenUat: [],
		...((await $.store.get(storeKey(path)).catch(() => undefined)) as
			| Partial<Saved>
			| undefined),
	};
	const isFirst = (await read($, roadmapPath)) === "";
	// Merged, not replaced: this session's running agents stay, and so do the nodes it
	// linked before its first file loaded (another file's links stay with that file).
	await update($, agents, (now) => ({
		...keptAgents(saved.agents, true),
		...running(now),
	}));
	await update($, owners, (now) => mergeOwners(saved.owners, now, isFirst));
	await update($, seenUat, () => saved.seenUat);
	await update($, roadmapPath, () => path);
}

// A newly opened roadmap file (or a fresh session) brings its own attribution back first.
async function adoptRoadmap($: EngineInterface, filePath: unknown) {
	if (typeof filePath !== "string" || !filePath) return;
	if (filePath !== (await read($, roadmapPath)))
		await loadAttribution($, filePath);
}

async function announceUat($: EngineInterface, pending: HudNode[]) {
	const seen = new Set(await read($, seenUat));
	const fresh = pending.filter((n) => !seen.has(n.id));
	if (fresh.length > 0) $.ui.toast(uatToast(fresh));
	// Only what is ready now stays seen: an item sent back for a fix toasts again on its re-test.
	if (fresh.length === 0 && pending.length === seen.size) return;
	await update($, seenUat, () => pending.map((n) => n.id));
	await saveAttribution($);
}

async function findUat($: EngineInterface, types: string[]) {
	const found: RawNode[] = [];
	for (const type of types) {
		const r = await callRR($, "findNodes", { type });
		found.push(...(r.nodes ?? []).map((f: { node: RawNode }) => f.node));
	}
	return found;
}

// Logged once per run of failures, not on every poll.
async function noteNotesFailure(
	$: EngineInterface,
	wasFailing: boolean,
	err: unknown,
) {
	if (wasFailing) return;
	$.ui.log(
		`RoadRaven · couldn't fetch UAT notes, showing the last ones: ${errText(err)}`,
	);
	await update($, uatNotes, (u) => ({ ...u, isFailing: true }));
}

// The pane draws UAT notes only: fetched when the UAT nodes or their statuses change,
// and on a failure the last ones fetched stay drawn.
async function uatNotesFor($: EngineInterface, nodes: HudNode[]) {
	const sig = uatSig(nodes);
	const kept = await read($, uatNotes);
	if (kept.sig === sig) return kept.notes;
	try {
		const notes = notesById(await findUat($, uatTypes(nodes)));
		await update($, uatNotes, () => ({ sig, notes, isFailing: false }));
		return notes;
	} catch (err) {
		await noteNotesFailure($, kept.isFailing, err);
		return kept.notes;
	}
}

// Notes edited without a status change: the next refresh fetches them again.
async function forgetUatNotes($: EngineInterface) {
	await update($, uatNotes, (u) => ({ ...u, sig: null }));
}

// Owners of nodes that left the tree (deleted, or another file's) are dropped.
async function pruneOwners($: EngineInterface, nodes: HudNode[]) {
	const kept = await read($, owners);
	const live = inTree(kept, new Set(nodes.map((n) => n.id)));
	if (Object.keys(live).length === Object.keys(kept).length) return;
	await update($, owners, () => live);
	await saveAttribution($);
}

type Schema = { nodes?: RawNode[]; title?: unknown };

async function applySnapshot($: EngineInterface, schema: Schema, key: string) {
	const lean = flatten(schema.nodes ?? []);
	const nodes = withNotes(lean, await uatNotesFor($, lean));
	await update($, snapshot, () => ({
		title: roadmapTitle(schema.nodes ?? [], schema.title),
		nodes,
	}));
	await update($, seenRevision, () => key);
	await pruneOwners($, nodes);
	await announceUat(
		$,
		nodes.filter((n) => isUat(n) && n.status === "in-progress"),
	);
	const { working, awaiting } = workCounts(nodes);
	$.ui.status(
		`RR ${working} active · ${awaiting} awaiting · ${nodes.filter(isReadyUat).length} UAT`,
	);
}

// The same file at the same revision draws the same tree: nothing to redo, unless UAT notes failed.
async function isUnchanged($: EngineInterface, key: string) {
	const seen = await read($, seenRevision);
	return seen === key && !(await read($, uatNotes)).isFailing;
}

async function markOnline($: EngineInterface) {
	if ((await read($, error)) !== null) await update($, error, () => null);
	if ((await read($, offlineSince)) !== 0)
		await update($, offlineSince, () => 0);
	await openOnce($);
}

async function syncSnapshot($: EngineInterface) {
	const {
		schema = {},
		filePath,
		revision,
	} = await callRR($, "getRoadmap", LEAN);
	await adoptRoadmap($, filePath);
	const key = `${filePath}@${revision}`;
	if (!(await isUnchanged($, key))) await applySnapshot($, schema, key);
	await markOnline($);
}

async function noteError($: EngineInterface, detail: string) {
	const isStarting = Date.now() - (await read($, startedAt)) < STARTING_MS;
	const next: HudError = { kind: shownKind(detail, isStarting), detail };
	if (JSON.stringify(next) !== JSON.stringify(await read($, error)))
		await update($, error, () => next);
}

// The pane opens by itself once, when RoadRaven first answers with a roadmap; `/roadraven` any time.
async function openOnce($: EngineInterface) {
	if (await read($, autoOpened)) return;
	await update($, autoOpened, () => true);
	await $.ui.open({ id: PANE, title: "RoadRaven" });
}

// ponytail: polls the whole tree every 4s; add a push frame to the event API if trees get large.
async function refreshOnce($: EngineInterface, themeChoice: string) {
	await syncPalette($, themeChoice);
	await update($, lastTry, () => Date.now());
	try {
		await syncSnapshot($);
	} catch (err) {
		await noteError($, errText(err));
		await update($, offlineSince, (t) => t || Date.now());
		await update($, seenRevision, () => "");
		$.ui.status(undefined);
	}
}

// Claims the run in one atomic update; asked while one runs, it only asks that run to go again.
async function claimRefresh($: EngineInterface) {
	let was = "idle";
	await update($, refreshing, (r) => {
		was = r;
		return r === "idle" ? "running" : "again";
	});
	return was === "idle";
}

// Ends the run, or keeps it for one more pass when another was asked for meanwhile.
async function takeAgain($: EngineInterface) {
	let was = "idle";
	await update($, refreshing, (r) => {
		was = r;
		return r === "again" ? "running" : "idle";
	});
	return was === "again";
}

// One refresh at a time, so a slow earlier read can never overwrite a newer snapshot.
async function refresh($: EngineInterface, themeChoice: string) {
	if (!(await claimRefresh($))) return;
	try {
		do await refreshOnce($, themeChoice);
		while (await takeAgain($));
	} catch (err) {
		await update($, refreshing, () => "idle");
		throw err;
	}
}

// Unreachable for a minute: ask every 30s instead of every 4s.
async function isBackingOff($: EngineInterface, now: number) {
	const since = await read($, offlineSince);
	return (
		since > 0 &&
		now - since > BACKOFF_AFTER_MS &&
		now - (await read($, lastTry)) < SLOW_POLL_MS
	);
}

async function poll($: EngineInterface, themeChoice: string) {
	if (!(await isBackingOff($, Date.now()))) await refresh($, themeChoice);
}

async function retry($: EngineInterface, themeChoice: string) {
	await update($, offlineSince, () => 0);
	await refresh($, themeChoice);
}

async function recordAgent($: EngineInterface, agent: HudAgent) {
	await update($, agents, (a) => ({ ...a, [agent.id]: agent }));
	await saveAttribution($);
}

async function setOwner($: EngineInterface, nodeId: string, agentId: string) {
	await update($, owners, (o) => ({ ...o, [nodeId]: agentId }));
	await saveAttribution($);
}

async function finishAgent($: EngineInterface, id: string, tokens: number) {
	await update($, agents, (a) => {
		const agent = a[id];
		return agent
			? {
					...a,
					[id]: {
						...agent,
						isDone: true,
						tokens: (agent.tokens ?? 0) + tokens,
					},
				}
			: a;
	});
	await saveAttribution($);
}

async function noteActivity($: EngineInterface, e: ToolCallInput) {
	const agentId = e.agentId;
	if (agentId)
		await update($, activity, (a) => ({
			...a,
			[agentId]: describeAction(e as never),
		}));
}

// An agent that sets a node's status is the one working it.
async function linkOwner($: EngineInterface, e: ToolCallInput) {
	const nodeId = (e as { nodeId?: unknown }).nodeId;
	if (typeof nodeId !== "string" || !e.tool.endsWith("__updateNodeStatus"))
		return;
	await setOwner($, nodeId, e.agentId ?? "main");
}

// --- what the pane's buttons do ---------------------------------------------------------------

function toggleDecision($: EngineInterface, id: string, d: Decision) {
	return update($, decisions, (all) => {
		const { [id]: was, ...rest } = all;
		return was === d ? rest : { ...rest, [id]: d };
	});
}

function toggleNotes($: EngineInterface, id: string) {
	return update($, openNotes, (all) => {
		const { [id]: was, ...rest } = all;
		return was ? rest : { ...rest, [id]: true as const };
	});
}

function dropDecisions($: EngineInterface, ids: string[]) {
	return update($, decisions, (all) =>
		Object.fromEntries(Object.entries(all).filter(([id]) => !ids.includes(id))),
	);
}

// Each appended note drops its decision at once, so a retry never appends it again.
async function appendItemNotes(
	$: EngineInterface,
	items: HudNode[],
	reasons: Record<string, string | undefined>,
	chosen: Record<string, Decision>,
) {
	for (const n of items) {
		const why = reasons[n.id];
		if (!why) continue;
		await callRR($, "updateNodeNotes", {
			nodeId: n.id,
			mode: "append",
			notes: uatNoteLine(chosen[n.id] ?? "pass", why),
		});
		await dropDecisions($, [n.id]);
	}
}

async function reportPartial(
	$: EngineInterface,
	plan: SendPlan,
	lines: string[],
	err: unknown,
) {
	const left = await read($, decisions);
	const missing = plan.items.filter((n) => left[n.id]).map((n) => q(n.title));
	await tell(
		$,
		`${reviewedText(plan.items.length, lines)}\nThe UAT note(s) of ${missing.join(", ")} could not be appended (${errText(err)}); the user may send them again.`,
	);
}

async function finishSend($: EngineInterface, plan: SendPlan, lines: string[]) {
	const text = await read($, note);
	const userNote = text ? `\nUser note: ${text}` : "";
	const isAwake = await wake(
		$,
		`${reviewedText(plan.items.length, lines)}${userNote}`,
	);
	await update($, sent, () => ({
		count: plan.items.length,
		at: Date.now(),
		isAwake,
	}));
	await update($, decisions, () => ({}));
	await update($, note, () => "");
	await update($, itemNotes, () => ({}));
}

async function writeStatuses(
	$: EngineInterface,
	marked: HudNode[],
	chosen: Record<string, Decision>,
) {
	const plan = await batch($, (nodes) => sendPlan(marked, chosen, nodes));
	const reasons = await read($, itemNotes);
	const why = Object.fromEntries(
		plan.items.map((n) => [n.id, itemNote(reasons, n.id)]),
	);
	// Written, and nothing left to append: done whatever happens next.
	await dropDecisions($, [
		...plan.skipped.map((n) => n.id),
		...plan.items.filter((n) => !why[n.id]).map((n) => n.id),
	]);
	return { plan, why };
}

async function sendDecisions($: EngineInterface, uat: HudNode[]) {
	const chosen = await read($, decisions);
	const marked = uat.filter((n) => chosen[n.id]);
	if (marked.length === 0)
		return $.ui.toast(
			"RoadRaven · mark Pass or Fail on at least one UAT item first",
		);
	const { plan, why } = await writeStatuses($, marked, chosen);
	if (plan.items.length === 0)
		return $.ui.toast(`RoadRaven · nothing sent${skippedToast(plan)}`);
	const lines = [
		...plan.items.map((n) =>
			decisionLine(n, chosen[n.id] ?? "pass", why[n.id]),
		),
		...plan.skipped.map(skippedLine),
	];
	try {
		await appendItemNotes($, plan.items, why, chosen);
	} catch (err) {
		await reportPartial($, plan, lines, err);
		throw err;
	}
	await finishSend($, plan, lines);
	$.ui.toast(
		`RoadRaven · UAT sent: ${plan.items.length} item(s)${skippedToast(plan)}`,
	);
}

// Claims the flag in one atomic update: a second press while one is running does nothing.
async function claimSend($: EngineInterface) {
	let wasSending = false;
	await update($, isSending, (s) => {
		wasSending = s;
		return true;
	});
	return !wasSending;
}

async function submitUat(
	$: EngineInterface,
	themeChoice: string,
	uat: HudNode[],
) {
	if (!(await claimSend($))) return;
	try {
		await sendDecisions($, uat);
	} catch (err) {
		$.ui.toast(`RoadRaven · couldn't send UAT decisions: ${plainError(err)}`);
	}
	await update($, isSending, () => false);
	await forgetUatNotes($);
	await refresh($, themeChoice);
}

async function runNode($: EngineInterface, n: HudNode) {
	const r = await $.agent.spawn({
		subagentType: "general-purpose",
		name: `rr-${n.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.slice(0, 24)}`,
		description: `RoadRaven: ${n.title}`.slice(0, 60),
		prompt: brief(n),
	});
	if (!r.agentId)
		return $.ui.toast(
			`RoadRaven · could not start an agent: ${r.deny ?? "refused"}`,
		);
	const id = r.agentId;
	await recordAgent($, {
		id,
		label: `rr: ${n.title}`,
		type: "general-purpose",
		model: r.model,
		effort: "default",
		startedAt: Date.now(),
		isDone: false,
	});
	await setOwner($, n.id, id);
	await tell(
		$,
		`The user started a one-off sub-agent on node ${q(n.title)} (${n.id}) outside the current plan. Don't re-plan or duplicate it; check its result when it reports back.`,
	);
	$.ui.toast(`RoadRaven · agent started on ${n.title}`);
}

async function nodeNotes($: EngineInterface, id: string) {
	try {
		const { node } = await callRR($, "getNode", { nodeId: id });
		return cleanNotes(String(node?.notes ?? ""));
	} catch {
		return "";
	}
}

// A first press of Run only asks; Start agent on the confirm row spawns.
async function askRun($: EngineInterface, id: string) {
	await update($, runNotes, () => "");
	await update($, confirmRun, () => id);
	const notes = await nodeNotes($, id);
	if ((await read($, confirmRun)) === id)
		await update($, runNotes, () => notes);
}

async function claimStart($: EngineInterface, id: string) {
	let wasStarting = false;
	await update($, starting, (s) => {
		wasStarting = s[id] === true;
		return { ...s, [id]: true as const };
	});
	return !wasStarting;
}

async function runIfStillNew($: EngineInterface, n: HudNode) {
	const { nodes } = await freshRead($);
	if (!isNotStarted(nodes, n.id)) return $.ui.toast(goneToast(n));
	await runNode($, n);
}

async function startAgent($: EngineInterface, themeChoice: string, n: HudNode) {
	await update($, confirmRun, () => "");
	if (!(await claimStart($, n.id))) return;
	try {
		await runIfStillNew($, n);
	} catch (err) {
		$.ui.toast(`RoadRaven · could not start an agent: ${plainError(err)}`);
	}
	await update($, starting, ({ [n.id]: _, ...rest }) => rest);
	await refresh($, themeChoice);
}

async function markNext($: EngineInterface, n: HudNode) {
	const { updates } = await batch($, (nodes) => nextPlan(nodes, n.id));
	if (updates.length === 0) return $.ui.toast(goneToast(n));
	await tell(
		$,
		`The user asks to prioritise node ${q(n.title)} (${n.id}) next. Its metadata now has priority: "next"; pick it up before other not-started work.`,
	);
	$.ui.toast(`RoadRaven · ${n.title} marked next`);
}

async function prioritise($: EngineInterface, themeChoice: string, n: HudNode) {
	try {
		await markNext($, n);
	} catch (err) {
		$.ui.toast(`RoadRaven · couldn't mark ${n.title} next: ${plainError(err)}`);
	}
	await refresh($, themeChoice);
}

// Go to app: RoadRaven selects and centres the node and comes to the front.
async function goToApp($: EngineInterface, id: string) {
	try {
		await callRR($, "revealNode", { nodeId: id });
	} catch (err) {
		$.ui.toast(revealFailure(errText(err), (await read($, error)) === null));
	}
}

// --- drawing ------------------------------------------------------------------------------------

function drawChoice(
	$: EngineInterface,
	{ els, P }: View,
	n: HudNode,
	d: Decision,
	isOn: boolean,
) {
	const { Box, Text, Button } = els;
	const ink = P[CHOICE[d].ink];
	const fill = isOn ? { backgroundColor: ink, color: P.bg } : { color: ink };
	return (
		<Box
			borderStyle={isOn ? "bold" : "round"}
			borderColor={ink}
			marginRight={1}
		>
			<Button
				key={`${d}-${n.id}`}
				plain
				onPress={() => toggleDecision($, n.id, d)}
			>
				<Text bold {...fill}>
					{CHOICE[d].label}
				</Text>
			</Button>
		</Box>
	);
}

function drawItemNote(
	$: EngineInterface,
	v: View,
	n: HudNode,
	d: Decision,
	value: string,
) {
	const { els } = v;
	if (!("Input" in els)) return null; // mobile draws no field
	const { Box, Input } = els;
	const save = (t: string) =>
		void update($, itemNotes, (f) => ({ ...f, [n.id]: t }));
	return (
		<Box marginLeft={4} flexDirection="column">
			<Input
				key={`why-${n.id}`}
				placeholder={CHOICE[d].placeholder}
				value={value}
				onInput={save}
				onSubmit={save}
			/>
			{drawSaved(v, value)}
		</Box>
	);
}

function drawNotesToggle(
	$: EngineInterface,
	{ els }: View,
	n: HudNode,
	isOpen: boolean,
) {
	return (
		<els.Button
			key={`notes-${n.id}`}
			plain
			label={isOpen ? " less" : " more"}
			onPress={() => toggleNotes($, n.id)}
		/>
	);
}

function drawUatNotes(
	$: EngineInterface,
	v: View,
	n: HudNode,
	notes: string,
	isOpen: boolean,
) {
	const { Box, Text } = v.els;
	return (
		<Box marginLeft={4} flexDirection={isOpen ? "column" : "row"}>
			{isOpen ? (
				drawFullNotes(v, notes)
			) : (
				<Text color={v.P.tertiary} wrap="truncate-end">
					{notes.split("\n")[0]}
				</Text>
			)}
			{hasMoreNotes(notes) && drawNotesToggle($, v, n, isOpen)}
		</Box>
	);
}

function drawGoTo($: EngineInterface, { els }: View, n: HudNode) {
	return (
		<els.Button
			key={`goto-${n.id}`}
			plain
			label=" ↗ Show in app "
			onPress={() => goToApp($, n.id)}
		/>
	);
}

function drawActiveNode($: EngineInterface, v: View, d: Data, n: HudNode) {
	const { Box, Text } = v.els;
	const ownerId = d.owner[n.id];
	const a = ownerId ? d.who[ownerId] : undefined;
	return (
		<Box key={n.id} flexDirection="column">
			<Box>
				<Box flexGrow={1}>
					<Text wrap="truncate-end">
						<Text color={v.P.inProgress}> ● </Text>
						<Text color={v.P.primary}>{n.title}</Text>
					</Text>
				</Box>
				{drawGoTo($, v, n)}
			</Box>
			{a ? drawAgent(v, a, d.act[a.id]) : drawUnowned(v, n, ownerId)}
		</Box>
	);
}

function drawActive(
	$: EngineInterface,
	v: View,
	d: Data,
	active: HudNode[],
	loose: HudAgent[],
) {
	const { Box } = v.els;
	return (
		<Box flexDirection="column">
			{pill(v, "ACTIVE WORK", active.length)}
			{active.length === 0 && quiet(v, "nothing in progress")}
			{active.map((n) => drawActiveNode($, v, d, n))}
			{loose.length > 0 && pill(v, "AGENTS WITHOUT A NODE", loose.length)}
			{loose.map((a) => (
				<Box key={a.id}>{drawAgent(v, a, d.act[a.id])}</Box>
			))}
		</Box>
	);
}

function drawUatItem($: EngineInterface, v: View, d: Data, n: HudNode) {
	const { Box } = v.els;
	const choice = d.decided[n.id];
	return (
		<Box key={n.id} flexDirection="column">
			<Box>
				<Box flexGrow={1}>{drawUatTitle(v, n, choice)}</Box>
				{drawGoTo($, v, n)}
			</Box>
			{n.notes && drawUatNotes($, v, n, n.notes, d.notesOpen[n.id] === true)}
			<Box marginLeft={4}>
				{drawChoice($, v, n, "pass", choice === "pass")}
				{drawChoice($, v, n, "fail", choice === "fail")}
			</Box>
			{choice && drawItemNote($, v, n, choice, d.itemText[n.id] ?? "")}
		</Box>
	);
}

function drawUatSend($: EngineInterface, v: View, d: Data, uat: HudNode[]) {
	const { els, themeChoice } = v;
	const { Box, Button } = els;
	const marked = uat.filter((n) => d.decided[n.id]).length;
	const save = (t: string) => void update($, note, () => t);
	return (
		<Box flexDirection="column" marginTop={1}>
			{"Input" in els && (
				<els.Input
					key="uat-note"
					placeholder="Note for the orchestrator (optional)"
					value={d.noteText}
					onInput={save}
					onSubmit={save}
				/>
			)}
			{drawSaved(v, d.noteText)}
			<Box>
				<Button
					key="uat-submit"
					label={
						d.sending
							? "Sending…"
							: `Send ${marked} decision(s) to orchestrator`
					}
					variant="primary"
					onPress={() => submitUat($, themeChoice, uat)}
				/>
			</Box>
		</Box>
	);
}

function drawUat(
	$: EngineInterface,
	v: View,
	d: Data,
	uat: HudNode[],
	fixing: HudNode[],
	waiting: number,
) {
	const { Box } = v.els;
	return (
		<Box flexDirection="column">
			{pill(v, "UAT", uat.length)}
			{uat.length === 0 && quiet(v, "nothing waiting for acceptance")}
			{uat.map((n) => drawUatItem($, v, d, n))}
			{fixing.map((n) => drawFixing(v, n))}
			{notReady(v, waiting)}
			{uat.length > 0 && drawUatSend($, v, d, uat)}
			{drawSent(v, d.lastSent)}
		</Box>
	);
}

function drawRun($: EngineInterface, { els, P }: View, d: Data, n: HudNode) {
	if (isBusy(d, n.id))
		return <els.Text color={P.inProgress}> running </els.Text>;
	return (
		<els.Button
			key={`run-${n.id}`}
			label="Run"
			onPress={() => askRun($, n.id)}
		/>
	);
}

function drawRunConfirm(
	$: EngineInterface,
	v: View,
	n: HudNode,
	notes: string,
) {
	const { Box, Text, Button } = v.els;
	return (
		<Box key={n.id} flexDirection="column" marginLeft={2}>
			<Text wrap="truncate-end">
				<Text color={v.P.accent}>Start an agent on </Text>
				<Text color={v.P.primary}>{n.title}</Text>
			</Text>
			{notes && (
				<Text color={v.P.tertiary} wrap="truncate-end">
					{notes.split("\n")[0]}
				</Text>
			)}
			<Box>
				<Button
					key={`run-start-${n.id}`}
					label="Start agent"
					variant="primary"
					onPress={() => startAgent($, v.themeChoice, n)}
				/>
				<Text> </Text>
				<Button
					key={`run-cancel-${n.id}`}
					label="Cancel"
					onPress={() => update($, confirmRun, () => "")}
				/>
			</Box>
		</Box>
	);
}

function drawBacklogEntry($: EngineInterface, v: View, d: Data, n: HudNode) {
	if (d.confirmId === n.id && !isBusy(d, n.id))
		return drawRunConfirm($, v, n, d.confirmNotes);
	return drawBacklogRow($, v, d, n);
}

function drawBacklogRow($: EngineInterface, v: View, d: Data, n: HudNode) {
	const { els, P, themeChoice } = v;
	const { Box, Text, Button } = els;
	return (
		<Box key={n.id}>
			<Box flexGrow={1}>
				<Text wrap="truncate-end">
					<Text color={P.notStarted}>
						{"  ".repeat(Math.min(n.depth, 4) + 1)}○{" "}
					</Text>
					<Text color={P.primary}>{n.title}</Text>
					{n.priority === "next" && (
						<Text color={P.accent} bold>
							{" "}
							↑ next
						</Text>
					)}
				</Text>
			</Box>
			{drawRun($, v, d, n)}
			<Text> </Text>
			<Button
				key={`next-${n.id}`}
				label="Next"
				onPress={() => prioritise($, themeChoice, n)}
			/>
			{drawGoTo($, v, n)}
		</Box>
	);
}

function drawBacklogRows(
	$: EngineInterface,
	v: View,
	d: Data,
	backlog: HudNode[],
) {
	const hidden = backlog.length - BACKLOG_MAX;
	return [
		...backlog.slice(0, BACKLOG_MAX).map((n) => drawBacklogEntry($, v, d, n)),
		hidden > 0 && (
			<v.els.Text key="backlog-more" color={v.P.tertiary}>
				{" "}
				+{hidden} more
			</v.els.Text>
		),
	];
}

function drawBacklog($: EngineInterface, v: View, d: Data, backlog: HudNode[]) {
	const { Box, Button } = v.els;
	const isOpen = d.backlogOpen;
	return (
		<Box flexDirection="column">
			<Box>
				{pill(v, "BACKLOG", backlog.length)}
				<Box marginTop={1}>
					<Button
						key="backlog-toggle"
						plain
						label={isOpen ? "[hide]" : "[show]"}
						onPress={() => update($, showBacklog, (o) => !o)}
					/>
				</Box>
			</Box>
			{isOpen && drawBacklogRows($, v, d, backlog)}
		</Box>
	);
}

function drawPane($: EngineInterface, v: View, d: Data) {
	const nodes = d.snap.nodes;
	const { active, working, awaiting } = workCounts(nodes);
	const uat = nodes.filter(isReadyUat);
	const waiting = nodes.filter(
		(n) => isUat(n) && n.status === "not-started",
	).length;
	const backlog = nodes.filter((n) => n.status === "not-started" && !isUat(n));
	const linked = new Set(Object.values(d.owner));
	const loose = Object.values(d.who).filter(
		(a) => !a.isDone && !linked.has(a.id),
	);
	return (
		<v.els.Box
			flexDirection="column"
			borderStyle="round"
			borderColor={v.P.border}
			backgroundColor={v.P.bg}
			paddingX={1}
		>
			{drawHeader(
				v,
				d.snap.title,
				`${working} active · ${awaiting} awaiting UAT · ${uat.length} UAT · ${backlog.length} backlog`,
			)}
			{drawActive($, v, d, active, loose)}
			{drawUat($, v, d, uat, nodes.filter(isFixingUat), waiting)}
			{drawBacklog($, v, d, backlog)}
		</v.els.Box>
	);
}

function drawError($: EngineInterface, v: View, err: HudError) {
	const { els, P } = v;
	const { Box, Text, Button } = els;
	const c = CONN[err.kind];
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={P[c.ink]}
			backgroundColor={P.bg}
			paddingX={1}
		>
			<Box>
				<Box flexGrow={1}>
					<Text color={P[c.ink]}>RoadRaven · {c.text}</Text>
				</Box>
				<Button
					key="rr-retry"
					label="Retry"
					onPress={() => retry($, v.themeChoice)}
				/>
			</Box>
			{err.kind === "other" && (
				<Text color={P.tertiary} dimColor wrap="truncate-end">
					{err.detail}
				</Text>
			)}
		</Box>
	);
}

async function readData($: EngineInterface): Promise<Data> {
	const [
		snap,
		who,
		owner,
		act,
		decided,
		noteText,
		itemText,
		backlogOpen,
		notesOpen,
		lastSent,
		sending,
		confirmId,
		confirmNotes,
		starts,
	] = await Promise.all([
		read($, snapshot),
		read($, agents),
		read($, owners),
		read($, activity),
		read($, decisions),
		read($, note),
		read($, itemNotes),
		read($, showBacklog),
		read($, openNotes),
		read($, sent),
		read($, isSending),
		read($, confirmRun),
		read($, runNotes),
		read($, starting),
	]);
	return {
		snap,
		who,
		owner,
		act,
		decided,
		noteText,
		itemText,
		backlogOpen,
		notesOpen,
		lastSent,
		sending,
		confirmId,
		confirmNotes,
		starts,
	};
}

// --- hooks --------------------------------------------------------------------------------------

export const register: Register = (on, options) => {
	const themeChoice = String(options.theme ?? "follow-app");
	// Agent tool call → its spawn: effort is only on the tool input, so carry it across by tool_use_id.
	const efforts = new Map<string, string>();
	const rememberEffort = (e: ToolCallInput) => {
		if (e.tool === "Agent" && e.effort) efforts.set(e.tool_use_id, e.effort);
	};
	const takeEffort = (toolUseId: string) => {
		const effort = efforts.get(toolUseId) ?? "default";
		efforts.delete(toolUseId);
		return effort;
	};

	on("session.start", async ($, e, next) => {
		await update($, startedAt, () => Date.now());
		await $.command.register({
			name: "roadraven",
			description: "Show RoadRaven active work, UAT and backlog in a pane",
		});
		// A failed refresh already shows in the pane; what still throws is dropped, not left unhandled.
		$.clock.every(
			POLL_MS,
			() => void poll($, themeChoice).catch(() => undefined),
		);
		void refresh($, themeChoice).catch(() => undefined);
		return next(e);
	});

	on("command.run", { command: "roadraven" }, async ($) => {
		await refresh($, themeChoice);
		await $.ui.open({ id: PANE, title: "RoadRaven" });
		return { text: "RoadRaven pane opened." };
	});

	on("tool.call", async ($, e, next) => {
		rememberEffort(e);
		await noteActivity($, e);
		if (!RR_TOOL.test(e.tool)) return next(e);
		const ran = await next(e);
		await linkOwner($, e);
		await forgetUatNotes($);
		void refresh($, themeChoice).catch(() => undefined);
		return ran;
	});

	on("agent.spawn", async ($, e, next) => {
		const r = await next(e);
		if (r.agentId)
			await recordAgent(
				$,
				toAgent(e, r.agentId, r.model, takeEffort(e.tool_use_id)),
			);
		return r;
	});

	on("turn.complete", async ($, e, next) => {
		if (e.agentId) await finishAgent($, e.agentId, tokensOf(e.usage));
		return next(e);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const v: View = {
			els: $.ui.resolve(e),
			P: await read($, palette),
			themeChoice,
		};
		const err = await read($, error);
		return err ? drawError($, v, err) : drawPane($, v, await readData($));
	});
};
