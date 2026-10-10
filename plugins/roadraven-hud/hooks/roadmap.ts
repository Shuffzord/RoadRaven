import type { HudNode } from "../types";

export type RawNode = {
	id: string;
	title: string;
	status: string;
	type?: string;
	notes?: string;
	metadata?: Record<string, unknown>;
	children?: RawNode[];
};

export const isUat = (n: HudNode) => n.type?.toLowerCase() === "uat";

// claude-haiku-5-5 → haiku 5.5
export const shortModel = (m: string) =>
	m.replace(/^claude-([a-z]+)-(\d+)-(\d+).*$/, "$1 $2.$3");

export const kTokens = (n: number) =>
	n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export function since(startedAt: number, now = Date.now()): string {
	const s = Math.max(0, Math.round((now - startedAt) / 1000));
	return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function toHudNode(n: RawNode, depth: number): HudNode {
	const priority = n.metadata?.priority;
	return {
		id: n.id,
		title: n.title,
		status: n.status,
		depth,
		type: n.type,
		notes: n.notes,
		priority: typeof priority === "string" ? priority : undefined,
	};
}

// The tree in reading order, each node with its depth.
export function flatten(list: RawNode[], depth = 0): HudNode[] {
	return list.flatMap((n) => [
		toHudNode(n, depth),
		...flatten(n.children ?? [], depth + 1),
	]);
}

const ARG_KEYS = [
	"command",
	"description",
	"file_path",
	"pattern",
	"url",
	"nodeId",
];

const toolName = (tool: string) =>
	tool.startsWith("mcp__") ? (tool.split("__").pop() ?? tool) : tool;

const argText = (key: string, arg: string) =>
	key === "file_path" ? (arg.split("/").pop() ?? arg) : arg.split("\n")[0];

// One line for what a tool call is doing: `Bash bun test`, `Read register.tsx`, `updateNodeStatus hud-w1`.
export function describeAction(
	e: { tool: string } & Record<string, unknown>,
): string {
	const key = ARG_KEYS.find((k) => typeof e[k] === "string");
	if (!key) return toolName(e.tool);
	return `${toolName(e.tool)} ${argText(key, String(e[key]))}`;
}
