// claudePlugin.ts — the `claude` CLI commands that install / update the
// RoadRaven Claude Code plugin (skills + the roadraven-hud pane). Kept as
// argument lists so Bun can run them without a shell; `--json` makes each
// command print one JSON result line.

/** One `claude` invocation, without the binary. */
export type ClaudeCommand = readonly string[];

export const PLUGIN_INSTALL_STEPS: readonly ClaudeCommand[] = [
	["plugin", "marketplace", "add", "Shuffzord/RoadRaven", "--json"],
	["plugin", "install", "roadraven@roadraven", "--json"],
];

/** `plugin install` re-adds a missing HUD; `plugin update roadraven` alone does not update it. */
export const PLUGIN_UPDATE_STEPS: readonly ClaudeCommand[] = [
	["plugin", "marketplace", "update", "roadraven", "--json"],
	["plugin", "update", "roadraven@roadraven", "--json"],
	["plugin", "install", "roadraven@roadraven", "--json"],
	["plugin", "update", "roadraven-hud@roadraven", "--json"],
];

/** The commands as one line a person can paste into a terminal (no `--json`). */
export function commandLine(steps: readonly ClaudeCommand[]): string {
	return steps
		.map((args) => ["claude", ...args.filter((a) => a !== "--json")].join(" "))
		.join("; ");
}

/** What the plugin dialog asks Bun to run; Bun maps it to a fixed list. */
export type PluginCommandKind = "install" | "update";

export const PLUGIN_STEPS: Record<PluginCommandKind, readonly ClaudeCommand[]> =
	{ install: PLUGIN_INSTALL_STEPS, update: PLUGIN_UPDATE_STEPS };
