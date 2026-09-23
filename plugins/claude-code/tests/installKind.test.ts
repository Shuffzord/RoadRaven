import { describe, expect, it } from "vitest";
import { detectInstallKind } from "../src/installKind";

describe("detectInstallKind", () => {
	it("is 'plugin' when ROADRAVEN_MCP_INSTALL=plugin, even from the npx cache", () => {
		expect(
			detectInstallKind(
				"plugin",
				"/home/u/.npm/_npx/1a2b/node_modules/@roadraven/mcp/dist/index.js",
			),
		).toBe("plugin");
	});

	it("is 'npm' when the entry script runs from the npx cache (POSIX)", () => {
		expect(
			detectInstallKind(
				undefined,
				"/home/u/.npm/_npx/1a2b/node_modules/.bin/roadraven-mcp",
			),
		).toBe("npm");
	});

	it("is 'npm' when the entry script runs from the npx cache (Windows)", () => {
		expect(
			detectInstallKind(
				undefined,
				"C:\\Users\\u\\AppData\\Local\\npm-cache\\_npx\\1a2b\\node_modules\\@roadraven\\mcp\\dist\\index.js",
			),
		).toBe("npm");
	});

	it("is 'local' for the Setup Wizard copy", () => {
		expect(
			detectInstallKind(
				undefined,
				"C:\\Users\\u\\AppData\\Local\\RoadRaven\\mcp\\roadraven-mcp.mjs",
			),
		).toBe("local");
	});

	it("is 'local' for a dev checkout, an unrecognised env value, or no entry path", () => {
		expect(
			detectInstallKind(
				undefined,
				"/src/RoadRaven/plugins/claude-code/dist/index.js",
			),
		).toBe("local");
		expect(detectInstallKind("something-else", undefined)).toBe("local");
		expect(detectInstallKind(undefined, undefined)).toBe("local");
	});

	it("does not treat a path merely containing '_npx' in a name as the npx cache", () => {
		expect(detectInstallKind(undefined, "/home/u/my_npx_tools/server.js")).toBe(
			"local",
		);
	});
});
