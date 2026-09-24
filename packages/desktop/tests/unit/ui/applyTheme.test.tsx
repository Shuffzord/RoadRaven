// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTheme } from "../../../../../shared/themeSchema";
import { applyTheme } from "../../../src/mainview/theme/applyTheme";
import { BUILT_IN_THEMES } from "../../../src/mainview/themes";

// applyTheme (v0.8.3 Phase 3) is the only writer of --rv-* on :root and of
// data-theme; it paints a resolved token map and forgets the previous one.

describe("applyTheme", () => {
	it("sets every token of the resolved map and data-theme on the root", () => {
		const root = document.createElement("div");
		const dark = BUILT_IN_THEMES[0];
		const resolved = resolveTheme(dark);
		applyTheme(resolved, dark.id, root);
		expect(root.getAttribute("data-theme")).toBe(dark.id);
		const unset = Object.entries(resolved)
			.filter(([name, value]) => root.style.getPropertyValue(name) !== value)
			.map(([name]) => name);
		expect(unset).toEqual([]);
	});

	it("removes tokens the previous theme set and the new one lacks", () => {
		const root = document.createElement("div");
		applyTheme(
			{ "--rv-bg-base": "#000000", "--rv-radius-md": "2px" },
			"first",
			root,
		);
		applyTheme({ "--rv-bg-base": "#111111" }, "second", root);
		expect(root.getAttribute("data-theme")).toBe("second");
		expect(root.style.getPropertyValue("--rv-bg-base")).toBe("#111111");
		expect(root.style.getPropertyValue("--rv-radius-md")).toBe("");
	});

	it("leaves non-theme inline properties alone", () => {
		const root = document.createElement("div");
		root.style.setProperty("--node-radius", "4px");
		applyTheme({ "--rv-bg-base": "#000000" }, "x", root);
		expect(root.style.getPropertyValue("--node-radius")).toBe("4px");
	});

	it("defaults to document.documentElement", () => {
		applyTheme({ "--rv-bg-base": "#010203" }, "doc");
		expect(document.documentElement.getAttribute("data-theme")).toBe("doc");
		expect(
			document.documentElement.style.getPropertyValue("--rv-bg-base"),
		).toBe("#010203");
	});

	it("is the only module under src/mainview that writes --rv-* or data-theme", () => {
		const root = join(__dirname, "../../../src/mainview");
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const full = join(dir, entry);
				if (statSync(full).isDirectory()) {
					walk(full);
					continue;
				}
				if (!/\.(ts|tsx)$/.test(entry)) continue;
				const src = readFileSync(full, "utf8");
				if (
					/setProperty\(\s*["'`]--rv-/.test(src) ||
					/setAttribute\(\s*["']data-theme["']/.test(src)
				) {
					offenders.push(relative(root, full).replace(/\\/g, "/"));
				}
			}
		};
		walk(root);
		expect(offenders).toEqual(["theme/applyTheme.ts"]);
	});
});
