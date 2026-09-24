// `roadraven-mcp init` — offers to add a RoadRaven planning section to a
// CLAUDE.md so Claude Code has a reason to use the MCP tools. Pure helpers
// here (tested); the interactive part lives in runInit.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

export type SnippetLevel = "project" | "user";

const START = "<!-- roadraven:start -->";
const END = "<!-- roadraven:end -->";

export const CLAUDE_MD_SNIPPET = `${START}
## RoadRaven (planning)

This project's plan is a RoadRaven roadmap (\`roadmap.json\`), shown live in the
RoadRaven desktop app and edited through the \`roadraven\` MCP tools.

- Before multi-step work, call \`getRoadmap\` and find the node for the task. If
  none exists, create one with \`createNode\` under the right parent.
- Mark the node as started with \`updateNodeStatus\` when you begin and as
  finished (or blocked) when you are done. Use the status names from
  \`getStatusConfig\`. Do this per task, not at the end.
- Record discovered sub-tasks as child nodes. Put decisions and findings in the
  node's notes with \`updateNodeNotes\`.
- If a tool returns \`app_not_running\`, tell the user to start RoadRaven, then
  continue the work without it.
${END}
`;

/** Where the snippet goes for a given level. */
export function resolveClaudeMdPath(
	level: SnippetLevel,
	cwd = process.cwd(),
	home = homedir(),
): string {
	return level === "user"
		? join(home, ".claude", "CLAUDE.md")
		: join(cwd, "CLAUDE.md");
}

/**
 * Returns the new file content. Appends the snippet when absent, replaces the
 * marked block when present (so re-running picks up a newer snippet), and
 * leaves everything else byte-for-byte untouched.
 */
export function applySnippet(existing: string | undefined): string {
	if (existing === undefined || existing === "") return CLAUDE_MD_SNIPPET;
	const start = existing.indexOf(START);
	const end = existing.indexOf(END);
	if (start !== -1 && end !== -1 && end > start) {
		const after = existing.slice(end + END.length);
		return (
			existing.slice(0, start) +
			CLAUDE_MD_SNIPPET.trimEnd() +
			(after.startsWith("\n") ? "" : "\n") +
			after
		);
	}
	const sep = existing.endsWith("\n") ? "\n" : "\n\n";
	return existing + sep + CLAUDE_MD_SNIPPET;
}

export function writeSnippet(path: string): "created" | "updated" | "appended" {
	const existed = existsSync(path);
	const existing = existed ? readFileSync(path, "utf8") : undefined;
	const hadBlock = existing?.includes(START) ?? false;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, applySnippet(existing), "utf8");
	if (!existed) return "created";
	return hadBlock ? "updated" : "appended";
}

export interface InitOptions {
	/** `--yes`: skip the confirmation prompt. */
	yes: boolean;
	/** `--level project|user`; anything else leaves it undefined (asked). */
	level?: SnippetLevel;
}

export function parseInitArgs(argv: string[]): InitOptions {
	const at = argv.indexOf("--level");
	const value = at === -1 ? undefined : argv[at + 1];
	return {
		yes: argv.includes("--yes"),
		level: value === "project" || value === "user" ? value : undefined,
	};
}

type Prompt = { question(q: string): Promise<string> };

async function ask(rl: Prompt, question: string): Promise<string> {
	return (await rl.question(question)).trim().toLowerCase();
}

/** Returns the level to write to, or undefined when the user declined. */
export async function askInitChoices(
	rl: Prompt,
	opts: InitOptions,
): Promise<SnippetLevel | undefined> {
	if (!opts.yes) {
		const answer = await ask(
			rl,
			"Add a RoadRaven planning section to a CLAUDE.md so Claude Code uses the roadmap? [Y/n] ",
		);
		if (answer === "n" || answer === "no") return undefined;
	}
	if (opts.level) return opts.level;
	const answer = await ask(
		rl,
		"Where? [p]roject ./CLAUDE.md (this repo only) or [u]ser ~/.claude/CLAUDE.md (every project)? [P/u] ",
	);
	return answer === "u" || answer === "user" ? "user" : "project";
}

/** CLI entry. Flags: `--level project|user` and `--yes` skip the prompts. */
export async function runInit(argv: string[]): Promise<void> {
	const opts = parseInitArgs(argv);
	let level = opts.level;
	if (!opts.yes || !level) {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		try {
			level = await askInitChoices(rl, opts);
		} finally {
			rl.close();
		}
	}
	if (!level) {
		console.log("Skipped. Run `roadraven-mcp init` again any time.");
		return;
	}
	const path = resolveClaudeMdPath(level);
	console.log(`${writeSnippet(path)}: ${path}`);
	console.log(
		"Restart Claude Code in that project so it re-reads CLAUDE.md. The RoadRaven app must be running for the tools to work.",
	);
}
