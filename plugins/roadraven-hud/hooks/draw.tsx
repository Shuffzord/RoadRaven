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
import { type BarProps, barKey, barLine } from "./bar";
import type { Decision } from "./plan";
import {
	MARK_KEY,
	MARK_MODE,
	type MarkMode,
	type MarkProps,
} from "./raven-mark";
import { kTokens, lastFailure, shortModel, since } from "./roadmap";

const NOTES_LONG = 80;
// Below this many body columns the header drops the raven mark rather than wrap around it.
export const MARK_MIN_COLUMNS = 48;

type Els = Elements[keyof Elements];
// What a drawing needs besides `$`, which the engine requires be passed on its own.
// `columns`: the pane body's width in cells.
export type View = {
	els: Els;
	P: HudPalette;
	themeChoice: string;
	columns: number;
};
export type Data = {
	snap: HudSnapshot;
	who: Record<string, HudAgent>;
	owner: Record<string, string>;
	act: Record<string, string>;
	decided: Record<string, Decision>;
	noteText: string;
	itemText: Record<string, string>;
	backlogOpen: boolean;
	notesOpen: Record<string, true>;
	lastSent: HudSent | null;
	sending: boolean;
	confirmId: string;
	confirmNotes: string;
	starts: Record<string, true>;
	still: boolean;
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

const titleLine = ({ els, P }: View, brand: string, title: string) => (
	<els.Text wrap="truncate-end">
		<els.Text color={P.accent} bold>
			{brand}
		</els.Text>
		<els.Text color={P.primary}> {title}</els.Text>
	</els.Text>
);

// Livelier while any agent runs.
const markMode = (d: Data): MarkMode =>
	Object.values(d.who).some((a) => !a.isDone) ? MARK_MODE.BUSY : MARK_MODE.IDLE;

// The animated raven, where the surface runs a Client and the pane is wide enough for it.
function drawMark({ els, P, columns }: View, d: Data) {
	if (!("Client" in els) || columns < MARK_MIN_COLUMNS) return null;
	const props: MarkProps = {
		still: d.still,
		mode: markMode(d),
		body: P.accent,
		hi: P.primary,
	};
	return <els.Client key={MARK_KEY} module="./raven-mark.tsx" props={props} />;
}

export function drawHeader(v: View, title: string, counts: string, d: Data) {
	const { Box, Text } = v.els;
	const mark = drawMark(v, d);
	const countLine = (
		<Text color={v.P.tertiary}>
			{counts} · {v.P.name}
		</Text>
	);
	if (!mark)
		return (
			<Box justifyContent="space-between">
				{titleLine(v, "◆ RoadRaven", title)}
				{countLine}
			</Box>
		);
	return (
		<Box>
			{mark}
			<Box flexDirection="column" flexGrow={1} marginLeft={2}>
				{titleLine(v, "RoadRaven", title)}
				{countLine}
			</Box>
		</Box>
	);
}

// A node's done/total children as a bar that eases to a new count; none for a leaf.
export function drawProgress({ els, P }: View, n: HudNode, still: boolean) {
	if (!n.total) return null;
	const props: BarProps = {
		done: n.done ?? 0,
		total: n.total,
		still,
		fill: P.completed,
		rest: P.notStarted,
		label: P.tertiary,
	};
	return (
		<els.Box marginLeft={4}>
			{"Client" in els ? (
				<els.Client key={barKey(n.id)} module="./bar.tsx" props={props} />
			) : (
				barLine(els.Text, props, props.done / props.total)
			)}
		</els.Box>
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

export function drawAgent(v: View, a: HudAgent, doing: string | undefined) {
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
export function drawUnowned(
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
