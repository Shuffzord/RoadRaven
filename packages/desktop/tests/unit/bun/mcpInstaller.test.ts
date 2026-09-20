import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildMcpServerEntry,
	buildOpenCodeServerEntry,
	detectPluginInstall,
	getClaudeConfigPath,
	getInstalledMcpServerPath,
	getOpenCodeConfigPath,
	getOpenCodeJsoncPath,
	getSetupStatus,
	installMcpIntegration,
	isMcpInstalled,
	MCP_SERVER_NAME,
	mergeMcpConfig,
	mergeOpenCodeConfig,
	resolveBundledMcpServer,
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

	it("installs cleanly when no Claude config exists yet", () => {
		const result = installMcpIntegration();
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

	it("preserves existing servers and keys when registering", () => {
		writeFileSync(
			getClaudeConfigPath(),
			JSON.stringify({
				numStartups: 7,
				mcpServers: { codegraph: { command: "codegraph", args: ["serve"] } },
			}),
			"utf-8",
		);
		const result = installMcpIntegration();
		expect(result.ok).toBe(true);
		const config = JSON.parse(readFileSync(getClaudeConfigPath(), "utf-8"));
		expect(config.numStartups).toBe(7);
		expect(config.mcpServers.codegraph.command).toBe("codegraph");
		expect(config.mcpServers[MCP_SERVER_NAME]).toBeDefined();
	});

	it("treats an empty/whitespace config file as absent and installs cleanly", () => {
		writeFileSync(getClaudeConfigPath(), "   \n", "utf-8");
		const result = installMcpIntegration();
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

	it("refuses to overwrite a corrupt config and reports the failing step", () => {
		const corrupt = "{ this is not json";
		writeFileSync(getClaudeConfigPath(), corrupt, "utf-8");
		const result = installMcpIntegration();
		expect(result.ok).toBe(false);
		const registerStep = result.steps.find((s) => s.id === "register");
		expect(registerStep?.status).toBe("error");
		// The corrupt file must be left exactly as-is.
		expect(readFileSync(getClaudeConfigPath(), "utf-8")).toBe(corrupt);
	});

	it("errors on the locate step when no bundled server is found", () => {
		process.env.ROADRAVEN_MCP_SERVER_PATH = join(sandbox, "does-not-exist.mjs");
		// Run from the sandbox so no cwd-relative workspace candidate resolves.
		const originalCwd = process.cwd();
		process.chdir(sandbox);
		try {
			const result = installMcpIntegration();
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
	function installOpenCodeExpectingError() {
		const result = installMcpIntegration(["opencode"]);
		expect(result.ok).toBe(false);
		const registerStep = result.steps.find((s) => s.id === "register-opencode");
		expect(registerStep?.status).toBe("error");
		return registerStep;
	}

	it("refuses to write OpenCode config when opencode.jsonc exists", () => {
		const jsoncPath = getOpenCodeJsoncPath();
		mkdirSync(dirname(jsoncPath), { recursive: true });
		writeFileSync(jsoncPath, "{ /* comment */ }", "utf-8");

		const registerStep = installOpenCodeExpectingError();
		expect(registerStep?.detail).toContain("opencode.jsonc");
		// No opencode.json should have been created.
		expect(existsSync(getOpenCodeConfigPath())).toBe(false);
	});

	it("refuses to overwrite an unparseable OpenCode config", () => {
		const corrupt = "{ this is not json";
		const configPath = getOpenCodeConfigPath();
		mkdirSync(dirname(configPath), { recursive: true });
		writeFileSync(configPath, corrupt, "utf-8");

		installOpenCodeExpectingError();
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
});
