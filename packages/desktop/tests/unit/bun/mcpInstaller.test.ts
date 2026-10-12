import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	commandLine,
	PLUGIN_INSTALL_STEPS,
} from "../../../../../shared/claudePlugin";
import type { McpInstallStep } from "../../../../../shared/types";
import { CLI_NOT_FOUND_LABEL } from "../../../src/bun/claudeCli";
import {
	buildMcpServerEntry,
	buildOpenCodeServerEntry,
	detectClaudeCode,
	detectPluginInstall,
	getClaudeConfigPath,
	getInstalledMcpServerPath,
	getOpenCodeConfigPath,
	getOpenCodeJsoncPath,
	getSetupStatus,
	installMcpIntegration,
	isInstalledMcpServerCurrent,
	isMcpInstalled,
	MCP_SERVER_NAME,
	mergeMcpConfig,
	mergeOpenCodeConfig,
	refreshInstalledMcpServer,
	resolveBundledMcpServer,
	writeClaudeConfig,
} from "../../../src/bun/mcpInstaller";

// --- Pure merge logic (no filesystem) --------------------------------------

describe("mergeMcpConfig", () => {
	it("creates mcpServers with the roadraven entry from an empty/null config", () => {
		const merged = mergeMcpConfig(null, "/abs/server.mjs");
		expect(merged).toEqual({
			mcpServers: {
				[MCP_SERVER_NAME]: {
					type: "stdio",
					command: "node",
					args: ["/abs/server.mjs"],
					env: {},
				},
			},
		});
	});

	it("preserves other top-level keys and other MCP servers", () => {
		const existing = {
			numStartups: 42,
			mcpServers: {
				codegraph: { type: "stdio", command: "codegraph", args: ["serve"] },
			},
		};
		const merged = mergeMcpConfig(existing, "/abs/server.mjs");
		expect(merged.numStartups).toBe(42);
		expect((merged.mcpServers as Record<string, unknown>).codegraph).toEqual(
			existing.mcpServers.codegraph,
		);
		expect(
			(merged.mcpServers as Record<string, unknown>)[MCP_SERVER_NAME],
		).toEqual(buildMcpServerEntry("/abs/server.mjs"));
	});

	it("overwrites a stale roadraven entry (idempotent refresh)", () => {
		const existing = {
			mcpServers: {
				[MCP_SERVER_NAME]: {
					type: "stdio",
					command: "node",
					args: ["/old/path.mjs"],
					env: {},
				},
			},
		};
		const merged = mergeMcpConfig(existing, "/new/path.mjs");
		expect(
			(merged.mcpServers as Record<string, { args: string[] }>)[MCP_SERVER_NAME]
				.args,
		).toEqual(["/new/path.mjs"]);
	});

	it("does not mutate the input config", () => {
		const existing = { mcpServers: { codegraph: { command: "codegraph" } } };
		const snapshot = JSON.stringify(existing);
		mergeMcpConfig(existing, "/abs/server.mjs");
		expect(JSON.stringify(existing)).toBe(snapshot);
	});
});

describe("mergeOpenCodeConfig", () => {
	it("creates mcp with the roadraven entry from an empty/null config", () => {
		const merged = mergeOpenCodeConfig(null, "/abs/server.mjs");
		expect(merged).toEqual({
			mcp: {
				[MCP_SERVER_NAME]: {
					type: "local",
					command: ["node", "/abs/server.mjs"],
					enabled: true,
				},
			},
		});
	});

	it("preserves other top-level keys and other MCP servers", () => {
		const existing = {
			provider: { anthropic: { apiKey: "x" } },
			autoupdate: false,
			permission: { edit: "allow" },
			mcp: {
				codegraph: { type: "local", command: ["codegraph", "serve"] },
			},
		};
		const merged = mergeOpenCodeConfig(existing, "/abs/server.mjs");
		expect(merged.provider).toEqual(existing.provider);
		expect(merged.autoupdate).toBe(false);
		expect(merged.permission).toEqual(existing.permission);
		expect((merged.mcp as Record<string, unknown>).codegraph).toEqual(
			existing.mcp.codegraph,
		);
		expect((merged.mcp as Record<string, unknown>)[MCP_SERVER_NAME]).toEqual(
			buildOpenCodeServerEntry("/abs/server.mjs"),
		);
	});

	it("does not mutate the input config", () => {
		const existing = { mcp: { codegraph: { command: ["codegraph"] } } };
		const snapshot = JSON.stringify(existing);
		mergeOpenCodeConfig(existing, "/abs/server.mjs");
		expect(JSON.stringify(existing)).toBe(snapshot);
	});
});

// --- Filesystem-touching behaviour, sandboxed via env overrides ------------

/** Stand-ins for runClaudeSteps: the plugin install either works or the CLI is missing. */
const pluginOk = async (): Promise<McpInstallStep[]> =>
	PLUGIN_INSTALL_STEPS.map((_, i) => ({
		id: `plugin-${i}`,
		label: "claude plugin ...",
		status: "ok",
		host: "claude",
	}));
const noCli = async (): Promise<McpInstallStep[]> => [
	{
		id: "claude-cli",
		label: CLI_NOT_FOUND_LABEL,
		status: "error",
		host: "claude",
	},
];

describe("writeClaudeConfig (file mode + symlinks)", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "rr-write-cfg-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});
	const posixOnly = process.platform === "win32" ? it.skip : it;
	const mode = (p: string) => statSync(p).mode & 0o777;

	posixOnly("keeps an existing 0600 file at 0600", () => {
		const path = join(dir, ".claude.json");
		writeFileSync(path, "{}", { mode: 0o600 });
		writeClaudeConfig(path, { a: 1 });
		expect(mode(path)).toBe(0o600);
		expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual({ a: 1 });
	});

	posixOnly("creates a new file as 0600", () => {
		const path = join(dir, "sub", ".claude.json");
		writeClaudeConfig(path, { a: 1 });
		expect(mode(path)).toBe(0o600);
	});

	posixOnly("writes through a symlink and keeps it a symlink", () => {
		const target = join(dir, "real.json");
		const link = join(dir, ".claude.json");
		writeFileSync(target, "{}", { mode: 0o600 });
		symlinkSync(target, link);
		writeClaudeConfig(link, { a: 1 });
		expect(lstatSync(link).isSymbolicLink()).toBe(true);
		expect(JSON.parse(readFileSync(target, "utf-8"))).toEqual({ a: 1 });
		expect(mode(target)).toBe(0o600);
	});
});

describe("installMcpIntegration (sandboxed)", () => {
	let sandbox: string;
	let sourceServer: string;
	const saved: Record<string, string | undefined> = {};
	const envKeys = [
		"HOME",
		"USERPROFILE",
		"LOCALAPPDATA",
		"XDG_CONFIG_HOME",
		"XDG_DATA_HOME",
		"ROADRAVEN_MCP_SERVER_PATH",
		"CLAUDE_CONFIG_DIR",
	];

	beforeEach(() => {
		sandbox = mkdtempSync(join(tmpdir(), "rr-mcp-test-"));
		for (const k of envKeys) saved[k] = process.env[k];
		// Point every home/data resolution at the sandbox so no real config is touched.
		process.env.HOME = sandbox;
		process.env.USERPROFILE = sandbox;
		process.env.LOCALAPPDATA = sandbox;
		process.env.XDG_CONFIG_HOME = sandbox;
		process.env.XDG_DATA_HOME = sandbox;
		delete process.env.CLAUDE_CONFIG_DIR;
		// Provide a fake bundled MCP server to copy from.
		sourceServer = join(sandbox, "bundled-server.mjs");
		writeFileSync(sourceServer, "// fake mcp server\n", "utf-8");
		process.env.ROADRAVEN_MCP_SERVER_PATH = sourceServer;
	});

	afterEach(() => {
		for (const k of envKeys) {
			if (saved[k] === undefined) delete process.env[k];
			else process.env[k] = saved[k];
		}
		rmSync(sandbox, { recursive: true, force: true });
	});

	it("installs cleanly when no Claude config exists yet", async () => {
		const result = await installMcpIntegration(undefined, noCli);
		expect(result.ok).toBe(true);

		// Server file copied to the stable user-data location.
		const installed = getInstalledMcpServerPath();
		expect(existsSync(installed)).toBe(true);
		expect(result.serverPath).toBe(installed);

		// Config created and points at the installed server.
		const config = JSON.parse(readFileSync(getClaudeConfigPath(), "utf-8"));
		expect(config.mcpServers[MCP_SERVER_NAME].args).toEqual([installed]);
		expect(isMcpInstalled()).toBe(true);
	});

	it("preserves existing servers and keys when registering", async () => {
		writeFileSync(
			getClaudeConfigPath(),
			JSON.stringify({
				numStartups: 7,
				mcpServers: { codegraph: { command: "codegraph", args: ["serve"] } },
			}),
			"utf-8",
		);
		const result = await installMcpIntegration(undefined, noCli);
		expect(result.ok).toBe(true);
		const config = JSON.parse(readFileSync(getClaudeConfigPath(), "utf-8"));
		expect(config.numStartups).toBe(7);
		expect(config.mcpServers.codegraph.command).toBe("codegraph");
		expect(config.mcpServers[MCP_SERVER_NAME]).toBeDefined();
	});

	it("treats an empty/whitespace config file as absent and installs cleanly", async () => {
		writeFileSync(getClaudeConfigPath(), "   \n", "utf-8");
		const result = await installMcpIntegration(undefined, noCli);
		expect(result.ok).toBe(true);
		const config = JSON.parse(readFileSync(getClaudeConfigPath(), "utf-8"));
		expect(config.mcpServers[MCP_SERVER_NAME]).toBeDefined();
	});

	it("resolveBundledMcpServer resolves relative to an anchor dir, not cwd", () => {
		delete process.env.ROADRAVEN_MCP_SERVER_PATH;
		const anchor = join(sandbox, "bundle-bin");
		mkdirSync(join(anchor, "mcp"), { recursive: true });
		const bundled = join(anchor, "mcp", "index.js");
		writeFileSync(bundled, "// bundle\n", "utf-8");
		// Anchor candidates are checked before cwd candidates, so this wins even
		// though the real dev bundle exists under the workspace cwd.
		expect(resolveBundledMcpServer([anchor])).toBe(bundled);
	});

	it("refuses to overwrite a corrupt config and reports the failing step", async () => {
		const corrupt = "{ this is not json";
		writeFileSync(getClaudeConfigPath(), corrupt, "utf-8");
		const result = await installMcpIntegration(undefined, noCli);
		expect(result.ok).toBe(false);
		const registerStep = result.steps.find((s) => s.id === "register");
		expect(registerStep?.status).toBe("error");
		// The corrupt file must be left exactly as-is.
		expect(readFileSync(getClaudeConfigPath(), "utf-8")).toBe(corrupt);
	});

	it("errors on the locate step when no bundled server is found", async () => {
		process.env.ROADRAVEN_MCP_SERVER_PATH = join(sandbox, "does-not-exist.mjs");
		// Run from the sandbox so no cwd-relative workspace candidate resolves.
		const originalCwd = process.cwd();
		process.chdir(sandbox);
		try {
			const result = await installMcpIntegration(undefined, noCli);
			expect(result.ok).toBe(false);
			expect(result.steps[0].id).toBe("locate");
			expect(result.steps[0].status).toBe("error");
		} finally {
			process.chdir(originalCwd);
		}
	});

	it("resolveBundledMcpServer honours the env override", () => {
		expect(resolveBundledMcpServer()).toBe(sourceServer);
	});

	it("getSetupStatus reflects the setup.completed flag", () => {
		expect(getSetupStatus("0.6.0", {}).firstRun).toBe(true);
		expect(
			getSetupStatus("0.6.0", { setup: { completed: true } }).firstRun,
		).toBe(false);
	});

	/** Runs installMcpIntegration(["opencode"]), asserting it failed at the register-opencode step. */
	async function installOpenCodeExpectingError() {
		const result = await installMcpIntegration(["opencode"], noCli);
		expect(result.ok).toBe(false);
		const registerStep = result.steps.find((s) => s.id === "register-opencode");
		expect(registerStep?.status).toBe("error");
		return registerStep;
	}

	it("refuses to write OpenCode config when opencode.jsonc exists", async () => {
		const jsoncPath = getOpenCodeJsoncPath();
		mkdirSync(dirname(jsoncPath), { recursive: true });
		writeFileSync(jsoncPath, "{ /* comment */ }", "utf-8");

		const registerStep = await installOpenCodeExpectingError();
		expect(registerStep?.detail).toContain("opencode.jsonc");
		// No opencode.json should have been created.
		expect(existsSync(getOpenCodeConfigPath())).toBe(false);
	});

	it("refuses to overwrite an unparseable OpenCode config", async () => {
		const corrupt = "{ this is not json";
		const configPath = getOpenCodeConfigPath();
		mkdirSync(dirname(configPath), { recursive: true });
		writeFileSync(configPath, corrupt, "utf-8");

		await installOpenCodeExpectingError();
		// The corrupt file must be left exactly as-is.
		expect(readFileSync(configPath, "utf-8")).toBe(corrupt);
	});

	it("detectPluginInstall is true for a roadraven@ marketplace key", () => {
		const path = join(sandbox, ".claude", "plugins", "installed_plugins.json");
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			JSON.stringify({
				version: 2,
				plugins: {
					"roadraven@some-marketplace": [{ installedAt: "2026-01-01" }],
				},
			}),
			"utf-8",
		);
		expect(detectPluginInstall()).toBe(true);
	});

	it("detectPluginInstall is false when the manifest is absent", () => {
		expect(detectPluginInstall()).toBe(false);
	});

	it("detectPluginInstall is false when the manifest is corrupt", () => {
		const path = join(sandbox, ".claude", "plugins", "installed_plugins.json");
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, "{ not json", "utf-8");
		expect(detectPluginInstall()).toBe(false);
	});

	// --- v0.9: the wizard installs the Claude Code plugin ---------------------

	function readConfig() {
		return JSON.parse(readFileSync(getClaudeConfigPath(), "utf-8"));
	}

	it("plugin installed: writes no entry, removes our old one, keeps other servers", async () => {
		writeFileSync(
			getClaudeConfigPath(),
			JSON.stringify({
				mcpServers: {
					codegraph: { command: "codegraph" },
					[MCP_SERVER_NAME]: buildMcpServerEntry(getInstalledMcpServerPath()),
				},
			}),
			"utf-8",
		);
		const result = await installMcpIntegration(["claude"], pluginOk);
		expect(result.ok).toBe(true);
		const config = readConfig();
		expect(config.mcpServers[MCP_SERVER_NAME]).toBeUndefined();
		expect(config.mcpServers.codegraph).toEqual({ command: "codegraph" });
		expect(result.steps.find((s) => s.id === "register")).toBeUndefined();
		expect(result.steps.find((s) => s.id === "dedupe")?.status).toBe("ok");
	});

	it("plugin installed with no config: creates no Claude config", async () => {
		const result = await installMcpIntegration(["claude"], pluginOk);
		expect(result.ok).toBe(true);
		expect(existsSync(getClaudeConfigPath())).toBe(false);
	});

	it("plugin installed: keeps a roadraven entry that is not ours and says how to remove it", async () => {
		const foreign = {
			type: "stdio",
			command: "npx",
			args: ["-y", "@roadraven/mcp"],
		};
		writeFileSync(
			getClaudeConfigPath(),
			JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: foreign } }),
			"utf-8",
		);
		const result = await installMcpIntegration(["claude"], pluginOk);
		expect(readConfig().mcpServers[MCP_SERVER_NAME]).toEqual(foreign);
		const advice = result.steps.find((s) => s.id === "dedupe");
		expect(advice?.status).toBe("skipped");
		expect(advice?.detail).toContain("claude mcp remove roadraven -s user");
	});

	it("plugin install fails: writes today's entry and gives the commands to run", async () => {
		const result = await installMcpIntegration(["claude"], noCli);
		expect(result.ok).toBe(true);
		expect(readConfig().mcpServers[MCP_SERVER_NAME].args).toEqual([
			getInstalledMcpServerPath(),
		]);
		const fallback = result.steps.find((s) => s.id === "plugin-fallback");
		expect(fallback?.detail).toContain(commandLine(PLUGIN_INSTALL_STEPS));
		expect(result.steps.some((s) => s.label === CLI_NOT_FOUND_LABEL)).toBe(
			true,
		);
	});

	it("honours CLAUDE_CONFIG_DIR for detection and writes", async () => {
		const dir = join(sandbox, "alt-claude");
		process.env.CLAUDE_CONFIG_DIR = dir;
		expect(getClaudeConfigPath()).toBe(join(dir, ".claude.json"));
		expect(detectClaudeCode()).toBe(false);
		const manifest = join(dir, "plugins", "installed_plugins.json");
		mkdirSync(dirname(manifest), { recursive: true });
		writeFileSync(
			manifest,
			JSON.stringify({ plugins: { "roadraven@roadraven": [{}] } }),
			"utf-8",
		);
		expect(detectClaudeCode()).toBe(true);
		expect(detectPluginInstall()).toBe(true);
		await installMcpIntegration(["claude"], noCli);
		expect(existsSync(join(dir, ".claude.json"))).toBe(true);
		expect(existsSync(join(sandbox, ".claude.json"))).toBe(false);
	});

	// --- v0.8: refreshing a stale wizard copy at startup ----------------------

	/** Writes a wizard copy with the given content, as an older app would have. */
	function writeWizardCopy(content: string): string {
		const installed = getInstalledMcpServerPath();
		mkdirSync(dirname(installed), { recursive: true });
		writeFileSync(installed, content, "utf-8");
		return installed;
	}

	it("refreshInstalledMcpServer never creates the wizard copy when absent", () => {
		expect(refreshInstalledMcpServer()).toBe("absent");
		expect(existsSync(getInstalledMcpServerPath())).toBe(false);
		expect(isInstalledMcpServerCurrent()).toBe(false);
	});

	it("refreshInstalledMcpServer overwrites a stale wizard copy with the bundled server", () => {
		const installed = writeWizardCopy(
			"// stale mcp server from an older app\n",
		);
		expect(isInstalledMcpServerCurrent()).toBe(false);

		expect(refreshInstalledMcpServer()).toBe("refreshed");

		expect(readFileSync(installed, "utf-8")).toBe(
			readFileSync(sourceServer, "utf-8"),
		);
		expect(existsSync(`${installed}.roadraven-tmp`)).toBe(false);
		expect(isInstalledMcpServerCurrent()).toBe(true);
	});

	it("refreshInstalledMcpServer leaves a current wizard copy alone", () => {
		writeWizardCopy(readFileSync(sourceServer, "utf-8"));
		expect(isInstalledMcpServerCurrent()).toBe(true);
		expect(refreshInstalledMcpServer()).toBe("current");
	});

	it("refreshInstalledMcpServer does not touch any host config", () => {
		writeWizardCopy("// stale\n");
		refreshInstalledMcpServer();
		expect(existsSync(getClaudeConfigPath())).toBe(false);
		expect(existsSync(getOpenCodeConfigPath())).toBe(false);
	});

	it("refreshInstalledMcpServer reports no-bundle and keeps the copy when no bundled server is found", () => {
		const installed = writeWizardCopy("// stale\n");
		process.env.ROADRAVEN_MCP_SERVER_PATH = join(sandbox, "does-not-exist.mjs");
		const originalCwd = process.cwd();
		process.chdir(sandbox);
		try {
			expect(refreshInstalledMcpServer()).toBe("no-bundle");
			expect(isInstalledMcpServerCurrent()).toBe(false);
		} finally {
			process.chdir(originalCwd);
		}
		expect(readFileSync(installed, "utf-8")).toBe("// stale\n");
	});
});
