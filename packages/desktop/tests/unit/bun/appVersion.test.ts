// The main-process app version has one source: packages/desktop/package.json.
import { describe, expect, it } from "vitest";
import pkg from "../../../package.json" with { type: "json" };
import { APP_VERSION } from "../../../src/bun/appVersion";

describe("APP_VERSION", () => {
	it("equals the version in packages/desktop/package.json", () => {
		expect(APP_VERSION).toBe(pkg.version);
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});
});
