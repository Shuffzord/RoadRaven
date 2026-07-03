// mcpInstaller.ts — installs the RoadRaven MCP integration into a Claude Code
// user config (v0.6 Setup Wizard).
//
// The wizard calls installMcpIntegration() which:
//   1. locates the bundled MCP server (packaged Resources, dev staging, or the
//      workspace build);
//   2. copies it to a stable path under the user data dir (so the registered
//      command survives app updates / moves);
//   3. merges a `roadraven` stdio server entry into the user's ~/.claude.json
//      `mcpServers` map, preserving every other server.
//
// The config-merge functions are kept pure and side-effect-free so they can be
// unit-tested without touching the real filesystem.

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AppSettings, McpInstallStep } from "../../../../shared/types";
import { getUserDataDir } from "./settings";

/** Key under `mcpServers` that RoadRaven owns. Only this key is ever touched. */
export const MCP_SERVER_NAME = "roadraven";

/** stdio MCP server entry shape, matching what Claude Code writes itself. */
export interface McpServerEntry {
	type: "stdio";
	command: string;
	args: string[];
	env: Record<string, string>;
}

export interface McpInstallResult {
	ok: boolean;
	steps: McpInstallStep[];
	serverPath?: string;
	configPath?: string;
}

export interface SetupStatus {
	firstRun: boolean;
	claudeDetected: boolean;
	mcpServerAvailable: boolean;
	mcpInstalled: boolean;
	appVersion: string;
}

function homeDir(): string {
	return process.env.HOME || process.env.USERPROFILE || "";
}

/** Path to the user-scope Claude Code config that stores global MCP servers. */
export function getClaudeConfigPath(): string {
	return join(homeDir(), ".claude.json");
}

/**
 * True if Claude Code appears to be installed for this user. We treat either
 * the config file or the ~/.claude directory as sufficient evidence.
 */
export function detectClaudeCode(): boolean {
	return (
		existsSync(getClaudeConfigPath()) || existsSync(join(homeDir(), ".claude"))
	);
}

/** Stable absolute path where the MCP server is installed for registration. */
export function getInstalledMcpServerPath(): string {
	// `.mjs` forces Node to treat the bundle as ESM regardless of any
	// package.json in the user data dir (the bun build output is ESM).
	return join(getUserDataDir(), "mcp", "roadraven-mcp.mjs");
}

/**
 * Locate the bundled MCP server source to copy from. Checked in priority order:
 *   1. ROADRAVEN_MCP_SERVER_PATH override (tests / power users)
 *   2. packaged app — copied into Resources/app/mcp by electrobun.config.ts
 *   3. dev — staged bundle in packages/desktop/assets/mcp
 *   4. from-source — the workspace plugin build output
 * Returns null when none exist (the wizard surfaces an actionable error).
 */
export function resolveBundledMcpServer(anchorDirs?: string[]): string | null {
	const candidates: string[] = [];
	const override = process.env.ROADRAVEN_MCP_SERVER_PATH;
	if (override) candidates.push(override);
	// Packaged app: anchor lookups to the running module / executable location,
	// NOT process.cwd() — a launched desktop app's cwd is the launch directory
	// (Finder / Start-menu / shortcut), not the app bundle. `import.meta.dir` is
	// the bundled Bun module's dir at runtime; it is undefined outside Bun (e.g.
	// under vitest), so it is filtered out there. Several walk-up shapes are
	// tried because the exact Resources layout must be confirmed against a real
	// packaged build (electrobun copies assets/mcp/index.js → mcp/index.js).
	const anchors =
		anchorDirs ??
		[import.meta.dir, dirname(process.execPath)].filter(
			(d): d is string => typeof d === "string" && d.length > 0,
		);
	for (const a of anchors) {
		candidates.push(resolve(a, "mcp/index.js"));
		candidates.push(resolve(a, "../mcp/index.js"));
		candidates.push(resolve(a, "../Resources/app/mcp/index.js"));
		candidates.push(resolve(a, "../Resources/mcp/index.js"));
	}
	// Dev / from-source, resolved against where the dev process was launched.
	const cwd = process.cwd();
	candidates.push(resolve(cwd, "assets/mcp/index.js"));
	candidates.push(resolve(cwd, "packages/desktop/assets/mcp/index.js"));
	candidates.push(resolve(cwd, "plugins/claude-code/dist/index.js"));
	candidates.push(resolve(cwd, "../../plugins/claude-code/dist/index.js"));
	return candidates.find((p) => existsSync(p)) ?? null;
}

/** Build the stdio server entry that points Claude Code at our server file. */
export function buildMcpServerEntry(serverPath: string): McpServerEntry {
	// `node` must be on the PATH of the shell Claude Code spawns MCP servers in.
	// Safe assumption — Claude Code is itself a Node app — but note it is NOT
	// verified here: the wizard only checks the server file exists, not that it
	// runs, so a node-less host would fail later at MCP spawn time.
	return { type: "stdio", command: "node", args: [serverPath], env: {} };
}

/**
 * Pure merge: return a new config object with mcpServers.roadraven set to the
 * given server path, preserving all other keys and all other servers. `config`
 * is the parsed existing config, or null when no config file exists yet.
 */
export function mergeMcpConfig(
	config: Record<string, unknown> | null,
	serverPath: string,
): Record<string, unknown> {
	const base: Record<string, unknown> =
		config && typeof config === "object" ? { ...config } : {};
	const existing = base.mcpServers;
	const servers: Record<string, unknown> =
		existing && typeof existing === "object"
			? { ...(existing as Record<string, unknown>) }
			: {};
	servers[MCP_SERVER_NAME] = buildMcpServerEntry(serverPath);
	base.mcpServers = servers;
	return base;
}

/**
 * Read + parse the Claude config. Returns null when the file does not exist.
 * THROWS on a corrupt file — callers must not overwrite a config they could
 * not parse, or the user's entire Claude Code setup would be destroyed.
 */
export function readClaudeConfig(): Record<string, unknown> | null {
	const path = getClaudeConfigPath();
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, "utf-8");
	// Empty / whitespace-only file: nothing to preserve. Treat as absent (fresh
	// config) rather than corrupt, so the install proceeds instead of aborting.
	if (raw.trim() === "") return null;
	return JSON.parse(raw) as Record<string, unknown>;
}

/** Atomic-ish write via temp file + rename so a crash can't truncate the config. */
export function writeClaudeConfig(
	path: string,
	config: Record<string, unknown>,
): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const tmp = `${path}.roadraven-tmp`;
	writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	renameSync(tmp, path);
}

/** True if roadraven is registered AND its server file still exists on disk. */
export function isMcpInstalled(): boolean {
	try {
		const config = readClaudeConfig();
		const servers = config?.mcpServers as
			| Record<string, McpServerEntry>
			| undefined;
		const entry = servers?.[MCP_SERVER_NAME];
		const serverPath = entry?.args?.[0];
		return typeof serverPath === "string" && existsSync(serverPath);
	} catch {
		// Corrupt config → treat as not installed (install will fail loudly).
		return false;
	}
}

export function getSetupStatus(
	appVersion: string,
	settings: AppSettings,
): SetupStatus {
	return {
		firstRun: !settings.setup?.completed,
		claudeDetected: detectClaudeCode(),
		mcpServerAvailable: resolveBundledMcpServer() !== null,
		mcpInstalled: isMcpInstalled(),
		appVersion,
	};
}

/**
 * Install (or refresh) the RoadRaven MCP integration. Idempotent: re-running
 * re-copies the server file and re-writes the same registration. Each step is
 * recorded so the wizard can render live progress and stop at the first error.
 */
export function installMcpIntegration(): McpInstallResult {
	const steps: McpInstallStep[] = [];

	const source = resolveBundledMcpServer();
	if (!source) {
		steps.push({
			id: "locate",
			label: "Locate RoadRaven MCP server",
			status: "error",
			detail:
				"Bundled MCP server not found. Build it with " +
				"`bun run --cwd plugins/claude-code build`, or reinstall RoadRaven.",
		});
		return { ok: false, steps };
	}
	steps.push({
		id: "locate",
		label: "Locate RoadRaven MCP server",
		status: "ok",
		detail: source,
	});

	const dest = getInstalledMcpServerPath();
	try {
		mkdirSync(dirname(dest), { recursive: true });
		copyFileSync(source, dest);
		steps.push({
			id: "copy",
			label: "Install MCP server files",
			status: "ok",
			detail: dest,
		});
	} catch (e) {
		steps.push({
			id: "copy",
			label: "Install MCP server files",
			status: "error",
			detail: String(e),
		});
		return { ok: false, steps };
	}

	const configPath = getClaudeConfigPath();
	const claudeDetected = detectClaudeCode();
	steps.push({
		id: "detect",
		label: "Detect Claude Code",
		status: claudeDetected ? "ok" : "skipped",
		detail: claudeDetected
			? configPath
			: "No existing Claude Code config found — creating a new one.",
	});

	try {
		const existing = readClaudeConfig(); // throws on corrupt — do NOT overwrite
		const merged = mergeMcpConfig(existing, dest);
		writeClaudeConfig(configPath, merged);
		steps.push({
			id: "register",
			label: "Register 'roadraven' MCP server",
			status: "ok",
			detail: configPath,
		});
	} catch (e) {
		steps.push({
			id: "register",
			label: "Register 'roadraven' MCP server",
			status: "error",
			detail: `Could not update ${configPath} (is it valid JSON?): ${String(e)}`,
		});
		return { ok: false, steps };
	}

	return { ok: true, steps, serverPath: dest, configPath };
}
