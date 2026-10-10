// v0.8 version-mismatch remedy — the Bun process decides what the user should
// do; the renderer only displays it (EventToast). Version parsing and the
// detail format are covered end-to-end over a real socket in
// eventServer.test.ts (bun test).

import { describe, expect, it } from "vitest";
import { mismatchRemedy } from "../../../src/bun/eventServer";

/** A version as the event server parses it off a version string. */
const v = (major: number, minor: number, patch = 0, prerelease?: string) => ({
	major,
	minor,
	patch,
	prerelease,
});

describe("mismatchRemedy", () => {
	it("is update-app when the producer's major.minor is newer than the app's", () => {
		expect(mismatchRemedy(v(0, 9), v(0, 8), "plugin", true)).toBe("update-app");
		expect(mismatchRemedy(v(1, 0), v(0, 8), undefined, false)).toBe(
			"update-app",
		);
		expect(mismatchRemedy(v(0, 10), v(0, 9), "local", true)).toBe("update-app");
	});

	it("is not update-app for an older producer, even with a higher minor", () => {
		expect(mismatchRemedy(v(0, 7), v(0, 8), "npm", false)).toBe("update-npm");
		expect(mismatchRemedy(v(0, 12), v(1, 0), "npm", false)).toBe("update-npm");
	});

	it("compares the patch, then the prerelease, when major.minor match", () => {
		expect(mismatchRemedy(v(0, 8, 8), v(0, 8, 7), "plugin", true)).toBe(
			"update-app",
		);
		expect(mismatchRemedy(v(0, 8, 7), v(0, 8, 8), "plugin", true)).toBe(
			"update-plugin",
		);
		// A release is newer than its own prerelease.
		expect(
			mismatchRemedy(v(0, 9, 0), v(0, 9, 0, "canary.1"), "npm", true),
		).toBe("update-app");
		expect(
			mismatchRemedy(v(0, 9, 0, "canary.1"), v(0, 9, 0), "npm", true),
		).toBe("update-npm");
	});

	it("is update-plugin for an older Claude Code plugin install", () => {
		expect(mismatchRemedy(v(0, 7), v(0, 8), "plugin", true)).toBe(
			"update-plugin",
		);
		expect(mismatchRemedy(v(0, 7), v(0, 8), "plugin", false)).toBe(
			"update-plugin",
		);
	});

	it("is update-npm for an older npx install", () => {
		expect(mismatchRemedy(v(0, 7), v(0, 8), "npm", true)).toBe("update-npm");
	});

	it("is restart-agent for a local (or pre-v0.8, install-less) server when the wizard copy is current", () => {
		expect(mismatchRemedy(v(0, 7), v(0, 8), "local", true)).toBe(
			"restart-agent",
		);
		// A stale wizard copy from before v0.8 reports e.g. 0.1.0 and no install.
		expect(mismatchRemedy(v(0, 1), v(0, 8), undefined, true)).toBe(
			"restart-agent",
		);
	});

	it("is reinstall for a local or install-less server without a current wizard copy", () => {
		expect(mismatchRemedy(v(0, 7), v(0, 8), "local", false)).toBe("reinstall");
		expect(mismatchRemedy(v(0, 1), v(0, 8), undefined, false)).toBe(
			"reinstall",
		);
	});
});
