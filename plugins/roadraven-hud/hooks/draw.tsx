// The pane's drawing that needs no `$`: everything here takes what to draw and returns a tree.
// Drawing with a button stays in register.tsx, since `$` is never passed across an import.
import type { Elements } from "claude-code";
import type {
	HudAgent,
	HudNode,
	HudPalette,
	HudSent,
	HudSnapshot,
} from "../types";
import type { Decision } from "./plan";
import { kTokens, lastFailure, shortModel, since } from "./roadmap";

const NOTES_LONG = 80;

type Els = Elements[keyof Elements];
// What a drawing needs besides `$`, which the engine requires be passed on its own.
export type View = { els: Els; P: HudPalette; themeChoice: string };
export type Data = {
	snap: HudSnapshot;
	who: Record<string, HudAgent>;
	owner: Record<string, string>;
	act: Record<string, string>;
	decided: Record<string, Decision>;
	noteText: string;
	whyFailed: Record<string, string>;
	backlogOpen: boolean;
	notesOpen: Record<string, true>;
	lastSent: HudSent | null;
	sending: boolean;
	confirmId: string;
	confirmNotes: string;
	starts: Record<string, true>;
};

export function pill({ els, P }: View, label: string, count: number) {
	const { Box, Text } = els;
	return (
		<Box marginTop={1}>
			<Text
				backgroundColor={P.accent}
				color={P.onAccent}
				bold
			>{` ${label} `}</Text>
			<Text color={P.tertiary}> {count} </Text>
		</Box>
	);
}

export const quiet = ({ els, P }: View, text: string) => (
	<els.Text color={P.tertiary}> {text}</els.Text>
);

export function drawHeader({ els, P }: View, title: string, counts: string) {
	const { Box, Text } = els;
	return (
		<Box justifyContent="space-between">
			<Text wrap="truncate-end">
				<Text color={P.accent} bold>
					◆ RoadRaven
				</Text>
				<Text color={P.primary}> {title}</Text>
			</Text>
			<Text color={P.tertiary}>
				{counts} · {P.name}
			</Text>
		</Box>
	);
}

const agentMeta = (a: HudAgent) =>
	`${shortModel(a.model)} · ${a.effort} · ${since(a.startedAt)}${a.tokens ? ` · ${kTokens(a.tokens)} tok` : ""}`;

function drawDoing({ els, P }: View, a: HudAgent, doing: string | undefined) {
	if (a.isDone || !doing) return null;
	return (
		<els.Text color={P.tertiary} wrap="truncate-end">
			{"    ↳ "}
			{doing}
		</els.Text>
	);
}

function drawAgent(v: View, a: HudAgent, doing: string | undefined) {
	const { Box, Text } = v.els;
	return (
		<Box flexDirection="column">
			<Text wrap="truncate-end">
				<Text color={v.P.secondary}>
					{"    "}
					{a.label}
				</Text>
				<Text color={v.P.tertiary}> {agentMeta(a)}</Text>
				{a.isDone && <Text color={v.P.completed}> ✓ done</Text>}
			</Text>
			{drawDoing(v, a, doing)}
		</Box>
	);
}

// No agent linked: a phase only waiting on ready UAT says so instead of looking stalled.
function drawUnowned(
	{ els, P }: View,
	n: HudNode,
	ownerId: string | undefined,
) {
	if (n.awaitingUat)
		return (
			<els.Text color={P.accent}>
				{`    ◆ awaiting UAT · ${n.awaitingUat} check(s)`}
			</els.Text>
		);
	return (
		<els.Text color={P.tertiary}>
			{"    "}
			{ownerId === "main" ? "main session" : "no agent"}
		</els.Text>
	);
}

function drawActiveNode(v: View, d: Data, n: HudNode) {
	const { Box, Text } = v.els;
	const ownerId = d.owner[n.id];
	const a = ownerId ? d.who[ownerId] : undefined;
	return (
		<Box key={n.id} flexDirection="column">
			<Text wrap="truncate-end">
				<Text color={v.P.inProgress}> ● </Text>
				<Text color={v.P.primary}>{n.title}</Text>
			</Text>
			{a ? drawAgent(v, a, d.act[a.id]) : drawUnowned(v, n, ownerId)}
		</Box>
	);
}

export function drawActive(
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
			{active.map((n) => drawActiveNode(v, d, n))}
			{loose.length > 0 && pill(v, "AGENTS WITHOUT A NODE", loose.length)}
			{loose.map((a) => (
				<Box key={a.id}>{drawAgent(v, a, d.act[a.id])}</Box>
			))}
		</Box>
	);
}

// What a field holds, drawn under it: a surface may clear the field itself on Enter.
export function drawSaved({ els, P }: View, text: string) {
	if (!text) return null;
	const { Text } = els;
	return (
		<Text wrap="truncate-end">
			<Text color={P.tertiary}>{text}</Text>
			<Text color={P.completed} dimColor>
				{" "}
				✓ saved
			</Text>
		</Text>
	);
}

const sentTime = (at: number) => new Date(at).toTimeString().slice(0, 5);

export function drawSent({ els, P }: View, last: HudSent | null) {
	if (!last) return null;
	const then = last.isAwake
		? "the orchestrator is on it"
		: "it will be read at your next prompt";
	return (
		<els.Text color={P.completed}>
			{` ✓ Sent ${last.count} decision(s) at ${sentTime(last.at)} — ${then}`}
		</els.Text>
	);
}

function uatMark(P: HudPalette, d: Decision | undefined): [string, string] {
	if (d === "pass") return ["  ✓ ", P.completed];
	if (d === "fail") return ["  ✗ ", P.blocked];
	return ["  ◆ ", P.accent];
}

export function drawUatTitle(
	{ els, P }: View,
	n: HudNode,
	choice: Decision | undefined,
) {
	const { Text } = els;
	const [mark, ink] = uatMark(P, choice);
	return (
		<Text wrap="truncate-end">
			<Text color={ink}>{mark}</Text>
			<Text color={P.primary}>{n.title}</Text>
		</Text>
	);
}

function drawFailure({ els, P }: View, n: HudNode) {
	const f = lastFailure(n.notes);
	if (!f) return null;
	return (
		<els.Text color={P.blocked} wrap="truncate-end">
			{`  ✗ failed (${f.date}): ${f.reason}`}
		</els.Text>
	);
}

// A UAT item that failed: the agent's turn, so it is shown without Pass or Fail.
export function drawFixing(v: View, n: HudNode) {
	const { Box, Text } = v.els;
	return (
		<Box key={n.id} flexDirection="column">
			<Text wrap="truncate-end">
				<Text color={v.P.blocked}>{"  ✗ "}</Text>
				<Text color={v.P.primary}>{n.title}</Text>
				<Text color={v.P.blocked}> · failed, waiting for a fix</Text>
			</Text>
			{drawFailure(v, n)}
		</Box>
	);
}

export const hasMoreNotes = (notes: string) =>
	notes.includes("\n") || notes.length > NOTES_LONG;

export function drawFullNotes({ els, P }: View, notes: string) {
	const { Text } = els;
	if ("Markdown" in els) return <els.Markdown text={notes} dimColor />;
	return <Text color={P.tertiary}>{notes}</Text>;
}

export const notReady = (v: View, waiting: number) =>
	waiting > 0 && quiet(v, `${waiting} not ready yet`);

// An agent on the node: one starting from here, or one linked that hasn't finished.
export const isBusy = (d: Data, id: string) => {
	const ownerId = d.owner[id];
	return (
		d.starts[id] === true ||
		(ownerId !== undefined && d.who[ownerId]?.isDone !== true)
	);
};
