import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("CSS token naming convention", () => {
	it("all custom properties in @theme block use --rv-* or --color-rv-* prefix", () => {
		// Guards against accidentally introducing non-namespaced tokens
		// that could collide with third-party CSS or future Tailwind internals
		const css = readFileSync(
			join(__dirname, "../../../src/mainview/index.css"),
			"utf-8",
		);

		// Extract the @theme block content
		const themeMatch = css.match(/@theme\s*\{([^}]+)\}/s);
		expect(themeMatch).not.toBeNull();

		const themeContent = themeMatch![1];
		// Find all custom property declarations (--something: value)
		const props = themeContent.match(/--[\w-]+(?=\s*:)/g) || [];

		expect(props.length).toBeGreaterThan(0);
		for (const prop of props) {
			expect(prop).toMatch(/^--(color-rv-|rv-)/);
		}
	});
});
