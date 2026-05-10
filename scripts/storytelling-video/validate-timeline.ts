#!/usr/bin/env bun
/**
 * Pre-flight validator for storytelling-video timeline.json.
 *
 * Director-agent convergence check (per the agent-flow plan):
 *   1. Every @alias referenced is defined earlier in the timeline
 *      (via createNode `alias` or getRoadmap `captureRootAlias`).
 *   2. Cue timestamps strictly increase.
 *   3. Narration cues fall inside their declared act window.
 *   4. Final tree shape implied by createNode/createRoadmap cues matches
 *      demo.roadmap.json (titles only — ids are runtime UUIDs).
 *
 * Run: `bun scripts/storytelling-video/validate-timeline.ts`
 * Exit code 0 = pass, 1 = fail.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

interface Cue {
	act: 1 | 2 | 3 | 4;
	at_ms: number;
	op: string;
	args: Record<string, unknown>;
	alias?: string;
	captureRootAlias?: string;
	narratorBeat?: string;
	comment?: string;
}
interface Timeline {
	version: string;
	totalDurationMs: number;
	cues: Cue[];
}
interface NarrationCue {
	act: 1 | 2 | 3 | 4;
	at_ms: number;
	line: string;
}
interface Narration {
	cues: NarrationCue[];
}
interface DemoNode {
	title: string;
	status?: string;
	plugin?: { id?: string };
	children?: DemoNode[];
}
interface DemoRoadmap {
	nodes: DemoNode[];
}

const ACT_WINDOWS: Record<number, [number, number]> = {
	1: [0, 12000],
	2: [12000, 35000],
	3: [35000, 60000],
	4: [60000, 75000],
};

function load<T>(name: string): T {
	return JSON.parse(readFileSync(join(HERE, name), "utf8"));
}

const errors: string[] = [];
const warnings: string[] = [];
const fail = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const timeline = load<Timeline>("timeline.json");
const narration = load<Narration>("narration.cues.json");
const demo = load<DemoRoadmap>("demo.roadmap.json");

// ---- Check 1: aliases defined before use ------------------------------------
const knownAliases = new Set<string>();
for (const cue of timeline.cues) {
	for (const [k, v] of Object.entries(cue.args)) {
		if (typeof v === "string" && v.startsWith("@")) {
			const ref = v.slice(1);
			if (!knownAliases.has(ref)) {
				fail(
					`cue at ${cue.at_ms}ms (${cue.op}) references @${ref} via args.${k} before it was defined.`,
				);
			}
		}
	}
	if (cue.alias) knownAliases.add(cue.alias);
	if (cue.captureRootAlias) knownAliases.add(cue.captureRootAlias);
}

// ---- Check 2: cue timestamps strictly increase ------------------------------
for (let i = 1; i < timeline.cues.length; i++) {
	const prev = timeline.cues[i - 1];
	const cur = timeline.cues[i];
	if (cur.at_ms <= prev.at_ms) {
		fail(
			`cue #${i} at_ms=${cur.at_ms} not strictly greater than cue #${i - 1} at_ms=${prev.at_ms}.`,
		);
	}
}

// ---- Check 3: narration cues inside act windows -----------------------------
for (const ncue of narration.cues) {
	const window = ACT_WINDOWS[ncue.act];
	if (!window) {
		fail(`narration cue declares unknown act ${ncue.act}.`);
		continue;
	}
	if (ncue.at_ms < window[0] || ncue.at_ms > window[1]) {
		fail(
			`narration cue at ${ncue.at_ms}ms (act ${ncue.act}: "${ncue.line.slice(0, 40)}...") falls outside act window [${window[0]}, ${window[1]}].`,
		);
	}
}

// ---- Check 4: implied tree from cues equals demo.roadmap.json ---------------
interface ImpliedNode {
	alias: string | null;
	title: string;
	children: ImpliedNode[];
}
const implied = new Map<string, ImpliedNode>();
let rootAlias: string | null = null;
let rootImplied: ImpliedNode | null = null;
let lastTitleByAlias: Record<string, string> = {};

for (const cue of timeline.cues) {
	if (cue.op === "createRoadmap") {
		rootImplied = { alias: null, title: "Untitled", children: [] };
	} else if (cue.op === "getRoadmap" && cue.captureRootAlias) {
		// Bootstrap implied root from the currently-open file. Title unknown
		// until the first renameNode cue, so seed with an empty placeholder.
		rootAlias = cue.captureRootAlias;
		rootImplied = rootImplied ?? { alias: null, title: "", children: [] };
		rootImplied.alias = rootAlias;
		implied.set(rootAlias, rootImplied);
	} else if (cue.op === "renameNode") {
		const ref = (cue.args.nodeId as string)?.replace(/^@/, "");
		const node = implied.get(ref);
		if (node) node.title = cue.args.title as string;
		lastTitleByAlias[ref] = cue.args.title as string;
	} else if (cue.op === "createNode" && cue.alias) {
		const parentRef = (cue.args.parentId as string).replace(/^@/, "");
		const parent = implied.get(parentRef);
		const fresh: ImpliedNode = {
			alias: cue.alias,
			title: cue.args.title as string,
			children: [],
		};
		implied.set(cue.alias, fresh);
		if (parent) parent.children.push(fresh);
		else fail(`createNode #alias=${cue.alias} parent @${parentRef} unknown.`);
	}
}

function shapeOf(n: { title: string; children?: { title: string }[] }): string {
	if (!n.children?.length) return n.title;
	return `${n.title}{${n.children.map((c) => shapeOf(c as { title: string; children?: { title: string }[] })).join(",")}}`;
}

if (rootImplied && demo.nodes[0]) {
	const a = shapeOf(rootImplied);
	const b = shapeOf(demo.nodes[0]);
	if (a !== b) {
		fail(
			`implied tree shape from timeline cues does not match demo.roadmap.json.\n  implied:  ${a}\n  expected: ${b}`,
		);
	}
} else {
	fail("could not derive implied root tree from timeline cues.");
}

// ---- Check 5: every aliased node ends up status-changed in demo -------------
// (warning-only — not a hard requirement but flags forgotten Act 3 cues)
const statusBumps = new Map<string, string>();
for (const cue of timeline.cues) {
	if (cue.op === "updateNodeStatus") {
		const ref = (cue.args.nodeId as string).replace(/^@/, "");
		statusBumps.set(ref, cue.args.status as string);
	}
}
function expectedStatusFor(node: DemoNode, out: Map<string, string>): void {
	if (node.status) out.set(node.title, node.status);
	for (const c of node.children ?? []) expectedStatusFor(c, out);
}
const expectedByTitle = new Map<string, string>();
for (const root of demo.nodes) expectedStatusFor(root, expectedByTitle);
for (const [alias, finalStatus] of statusBumps.entries()) {
	const node = implied.get(alias);
	if (!node) continue;
	const expected = expectedByTitle.get(node.title);
	if (expected && expected !== finalStatus) {
		warn(
			`@${alias} ("${node.title}") final status from timeline = "${finalStatus}", but demo.roadmap.json expects "${expected}".`,
		);
	}
}

// ---- Output -----------------------------------------------------------------
if (warnings.length > 0) {
	console.log("Warnings:");
	for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length > 0) {
	console.error(`\nFAIL — ${errors.length} error(s):`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}
console.log(
	`\nOK — timeline.json valid. ${timeline.cues.length} cues, ${narration.cues.length} narration lines.`,
);
console.log(
	`     act 1 (${ACT_WINDOWS[1][0]}–${ACT_WINDOWS[1][1]}ms), act 2 (${ACT_WINDOWS[2][0]}–${ACT_WINDOWS[2][1]}ms), act 3 (${ACT_WINDOWS[3][0]}–${ACT_WINDOWS[3][1]}ms), act 4 (${ACT_WINDOWS[4][0]}–${ACT_WINDOWS[4][1]}ms).`,
);
