// How this MCP server was installed, reported to RoadRaven in the hello frame
// so a version-mismatch toast can tell the user which update applies.
export type InstallKind = "plugin" | "npm" | "local";

/**
 * `envValue` is ROADRAVEN_MCP_INSTALL, which the Claude Code plugin's .mcp.json
 * sets to "plugin". `entryPath` is the running entry script (process.argv[1]):
 * npx runs packages out of its `_npx` cache. Anything else is a file on disk —
 * the Setup Wizard's copy or a dev checkout.
 */
export function detectInstallKind(
	envValue: string | undefined,
	entryPath: string | undefined,
): InstallKind {
	if (envValue === "plugin") return "plugin";
	if (entryPath && /[\\/]_npx[\\/]/.test(entryPath)) return "npm";
	return "local";
}
