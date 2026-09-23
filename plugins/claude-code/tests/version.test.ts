import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { PACKAGE_VERSION } from "../src/version";

describe("PACKAGE_VERSION", () => {
	it("matches the version field in package.json", () => {
		expect(PACKAGE_VERSION).toBe(pkg.version);
	});
});
