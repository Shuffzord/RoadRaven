// mcpInstaller.ts — installs the RoadRaven MCP integration into a Claude Code
// and/or OpenCode user config (v0.6 Setup Wizard, multi-host as of v0.8).
//
// The wizard calls installMcpIntegration(hosts) which:
//   1. locates the bundled MCP server (packaged Resources, dev staging, or the
//      workspace build);
//   2. copies it to a stable path under the user data dir (so the registered
//      command survives app updates / moves);
//   3. for each targeted host, merges a `roadraven` server entry into that
//      host's config (~/.claude.json `mcpServers`, or
//      ~/.config/opencode/opencode.json `mcp`), preserving every other key
//      and every other server.
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
import type {
	AppSettings,
	McpHost,
	McpInstallStep,
} from "../../../../shared/types";
import { getUserDataDir } from "./settings";

/** Key under `mcpServers` / `mcp` that RoadRaven owns. Only this key is ever touched. */
export const MCP_SERVER_NAME = "roadraven";

/** stdio MCP server entry shape, matching what Claude Code writes itself. */
export interface McpServerEntry {
	type: "stdio";
	command: string;
	args: string[];
	env: Record<string, string>;
}

/** OpenCode local MCP server entry shape (verified against opencode.json + docs). */
export interface OpenCodeServerEntry {
	type: "local";
	command: string[];
	enabled: boolean;
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
	openCodeDetected: boolean;
	openCodeInstalled: boolean;
	pluginInstalled: boolean;
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

/** Path to the OpenCode config. OpenCode uses `~/.config` on Windows too. */
export function getOpenCodeConfigPath(): string {
	return join(homeDir(), ".config", "opencode", "opencode.json");
}

/** JSONC variant of the OpenCode config — RoadRaven never writes to this one. */
export function getOpenCodeJsoncPath(): string {
	return join(homeDir(), ".config", "opencode", "opencode.jsonc");
}

/**
 * True if OpenCode appears to be installed for this user. We treat either the
 * config file or the ~/.config/opencode directory as sufficient evidence.
 */
export function detectOpenCode(): boolean {
	return (
		existsSync(getOpenCodeConfigPath()) ||
		existsSync(join(homeDir(), ".config", "opencode"))
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

/**
 * True when the Setup Wizard's copy of the MCP server exists and is
 * byte-identical to the server bundled with this app. Never throws — an
 * unreadable file counts as not current.
 */
export function isInstalledMcpServerCurrent(): boolean {
	const dest = getInstalledMcpServerPath();
	const source = resolveBundledMcpServer();
	if (!source || !existsSync(dest)) return false;
	try {
		return readFileSync(source).equals(readFileSync(dest));
	} catch {
		return false;
	}
}

/**
 * Bring the Setup Wizard's copy of the MCP server up to date with the server
 * bundled in this app. A copy made by an older app goes stale when the app
 * updates and keeps reporting the old version. Only an existing copy is ever
 * overwritten — never created (the user didn't opt in) — and no host config
 * is touched: registrations point at the same path. MCP processes already
 * running keep the old code until their agent host restarts them.
 */
export function refreshInstalledMcpServer():
	| "absent"
	| "no-bundle"
	| "current"
	| "refreshed" {
	const dest = getInstalledMcpServerPath();
	if (!existsSync(dest)) return "absent";
	const source = resolveBundledMcpServer();
	if (!source) return "no-bundle";
	const bundled = readFileSync(source);
	if (bundled.equals(readFileSync(dest))) return "current";
	// Temp file + rename, like writeClaudeConfig, so a crash can't leave a
	// truncated server behind.
	const tmp = `${dest}.roadraven-tmp`;
	writeFileSync(tmp, bundled);
	renameSync(tmp, dest);
	return "refreshed";
}

/** Build the stdio server entry that points Claude Code at our server file. */
export function buildMcpServerEntry(serverPath: string): McpServerEntry {
	// `node` must be on the PATH of the shell Claude Code spawns MCP servers in.
	// Safe assumption — Claude Code is itself a Node app — but note it is NOT
	// verified here: the wizard only checks the server file exists, not that it
	// runs, so a node-less host would fail later at MCP spawn time.
	return { type: "stdio", command: "node", args: [serverPath], env: {} };
}

/** Build the OpenCode local server entry that points OpenCode at our server file. */
export function buildOpenCodeServerEntry(
	serverPath: string,
): OpenCodeServerEntry {
	return { type: "local", command: ["node", serverPath], enabled: true };
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
 * Pure merge: return a new config object with mcp.roadraven set to the given
 * server path, preserving all other keys (provider, autoupdate, permission,
 * ...) and all other servers. `config` is the parsed existing config, or null
 * when no config file exists yet.
 */
export function mergeOpenCodeConfig(
	config: Record<string, unknown> | null,
	serverPath: string,
): Record<string, unknown> {
	const base: Record<string, unknown> =
		config && typeof config === "object" ? { ...config } : {};
	const existing = base.mcp;
	const servers: Record<string, unknown> =
		existing && typeof existing === "object"
			? { ...(existing as Record<string, unknown>) }
			: {};
	servers[MCP_SERVER_NAME] = buildOpenCodeServerEntry(serverPath);
	base.mcp = servers;
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

/**
 * Read + parse the OpenCode config. Returns null when the file does not
 * exist. THROWS when a sibling opencode.jsonc exists (RoadRaven only writes
 * .json and must not risk clobbering a JSONC config with comments) or when
 * the JSON fails to parse — callers must not overwrite a config they could
 * not safely read.
 */
export function readOpenCodeConfig(): Record<string, unknown> | null {
	if (existsSync(getOpenCodeJsoncPath())) {
		throw new Error(
			"opencode.jsonc exists — RoadRaven only writes opencode.json and will not overwrite a JSONC config",
		);
	}
	const path = getOpenCodeConfigPath();
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, "utf-8");
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

/** True if roadraven is registered in OpenCode AND its server file still exists on disk. */
export function isOpenCodeMcpInstalled(): boolean {
	try {
		const config = readOpenCodeConfig();
		const servers = config?.mcp as
			| Record<string, OpenCodeServerEntry>
			| undefined;
		const entry = servers?.[MCP_SERVER_NAME];
		const serverPath = entry?.command?.[1];
		return typeof serverPath === "string" && existsSync(serverPath);
	} catch {
		// Corrupt / jsonc config → treat as not installed (install will fail loudly).
		return false;
	}
}

/** Path to Claude Code's plugin install manifest (v2 shape). */
function getPluginInstallPath(): string {
	return join(homeDir(), ".claude", "plugins", "installed_plugins.json");
}

/**
 * True when the RoadRaven Claude Code plugin is installed — detected by any
 * `installed_plugins.json` key starting with "roadraven@" (the
 * `<plugin>@<marketplace>` format). A missing or corrupt file means false;
 * this never throws.
 */
export function detectPluginInstall(): boolean {
	try {
		const path = getPluginInstallPath();
		if (!existsSync(path)) return false;
		const raw = readFileSync(path, "utf-8");
		if (raw.trim() === "") return false;
		const parsed = JSON.parse(raw) as { plugins?: Record<string, unknown> };
		const plugins = parsed?.plugins;
		if (!plugins || typeof plugins !== "object") return false;
		return Object.keys(plugins).some((key) => key.startsWith("roadraven@"));
	} catch {
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
		openCodeDetected: detectOpenCode(),
		openCodeInstalled: isOpenCodeMcpInstalled(),
		pluginInstalled: detectPluginInstall(),
	};
}

/**
 * Register the RoadRaven MCP server with Claude Code (~/.claude.json).
 * Returns the "detect" + "register" steps and whether registration
 * succeeded, for installMcpIntegration to fold into the overall result.
 */
function registerClaudeHost(dest: string): {
	ok: boolean;
	steps: McpInstallStep[];
} {
	const steps: McpInstallStep[] = [];
	const claudeConfigPath = getClaudeConfigPath();
	const claudeDetected = detectClaudeCode();
	steps.push({
		id: "detect",
		label: "Detect Claude Code",
		status: claudeDetected ? "ok" : "skipped",
		detail: claudeDetected
			? claudeConfigPath
			: "No existing Claude Code config found — creating a new one.",
		host: "claude",
	});

	try {
		const existing = readClaudeConfig(); // throws on corrupt — do NOT overwrite
		const merged = mergeMcpConfig(existing, dest);
		writeClaudeConfig(claudeConfigPath, merged);
		steps.push({
			id: "register",
			label: "Register 'roadraven' MCP server",
			status: "ok",
			detail: claudeConfigPath,
			host: "claude",
		});
		return { ok: true, steps };
	} catch (e) {
		steps.push({
			id: "register",
			label: "Register 'roadraven' MCP server",
			status: "error",
			detail: `Could not update ${claudeConfigPath} (is it valid JSON?): ${String(e)}`,
			host: "claude",
		});
		return { ok: false, steps };
	}
}

/**
 * Register the RoadRaven MCP server with OpenCode (~/.config/opencode/opencode.json).
 * Returns the "detect-opencode" + "register-opencode" steps and whether
 * registration succeeded, for installMcpIntegration to fold into the overall
 * result.
 */
function registerOpenCodeHost(dest: string): {
	ok: boolean;
	steps: McpInstallStep[];
} {
	const steps: McpInstallStep[] = [];
	const openCodeConfigPath = getOpenCodeConfigPath();
	const openCodeDetected = detectOpenCode();
	steps.push({
		id: "detect-opencode",
		label: "Detect OpenCode",
		status: openCodeDetected ? "ok" : "skipped",
		detail: openCodeDetected
			? openCodeConfigPath
			: "No existing OpenCode config found — creating a new one.",
		host: "opencode",
	});

	try {
		const existing = readOpenCodeConfig(); // throws on jsonc/corrupt — do NOT overwrite
		const merged = mergeOpenCodeConfig(existing, dest);
		writeClaudeConfig(openCodeConfigPath, merged);
		steps.push({
			id: "register-opencode",
			label: "Register 'roadraven' MCP server (OpenCode)",
			status: "ok",
			detail: openCodeConfigPath,
			host: "opencode",
		});
		return { ok: true, steps };
	} catch (e) {
		const snippet = JSON.stringify({
			mcp: { [MCP_SERVER_NAME]: buildOpenCodeServerEntry(dest) },
		});
		steps.push({
			id: "register-opencode",
			label: "Register 'roadraven' MCP server (OpenCode)",
			status: "error",
			detail: `Could not update ${openCodeConfigPath}: ${String(e)}. Add this to its "mcp" key by hand: ${snippet}`,
			host: "opencode",
		});
		return { ok: false, steps };
	}
}

/**
 * Install (or refresh) the RoadRaven MCP integration for the given hosts.
 * Idempotent: re-running re-copies the server file and re-writes the same
 * registration(s). Each step is recorded so the wizard can render live
 * progress. `hosts` omitted means every detected host; when explicitly given
 * (the wizard only offers detected hosts, per row checkbox), those hosts are
 * targeted regardless of current detection — same as the pre-v0.8 behaviour
 * for Claude Code, which registers even when no prior config was detected.
 * `configPath` in the result always points at the Claude config (back-compat
 * with pre-v0.8 callers), regardless of which hosts were targeted.
 */
export function installMcpIntegration(hosts?: McpHost[]): McpInstallResult {
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

	// `hosts` omitted: default to every detected host, plus Claude Code
	// unconditionally — pre-v0.8 callers always targeted Claude regardless of
	// detection (a fresh machine with no ~/.claude.json yet still gets one
	// created), so detection there is informational, not a gate. OpenCode is
	// new in v0.8 and opt-in: only targeted by default when actually detected.
	const targetHosts: McpHost[] =
		hosts ?? (detectOpenCode() ? ["claude", "opencode"] : ["claude"]);

	let ok = true;

	if (targetHosts.includes("claude")) {
		const claude = registerClaudeHost(dest);
		steps.push(...claude.steps);
		if (!claude.ok) ok = false;
	}

	if (targetHosts.includes("opencode")) {
		const openCode = registerOpenCodeHost(dest);
		steps.push(...openCode.steps);
		if (!openCode.ok) ok = false;
	}

	return { ok, steps, serverPath: dest, configPath: getClaudeConfigPath() };
}
