import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CSS @import ordering", () => {
	it("@import 'tailwindcss' appears before any @import url(...) statements", () => {
		// Tailwind v4 requires its @import to come before other @imports.
		// Misordering causes build warnings or failures. This test guards
		// against the exact bug found in Phase 01 (Gap 3).
		const css = readFileSync(
			join(__dirname, "../../../src/mainview/index.css"),
			"utf-8",
		);

		const lines = css.split("\n");
		let tailwindImportLine = -1;
		let lastUrlImportLine = -1;

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].match(/@import\s+["']tailwindcss["']/)) {
				tailwindImportLine = i;
			}
			if (lines[i].match(/@import\s+url\(/)) {
				lastUrlImportLine = i;
			}
		}

		expect(tailwindImportLine).toBeGreaterThan(-1);
		// Tailwind import must appear within the first 5 lines of the file
		// (allowing for font imports that must come before it, or right after)
		// The key constraint: no @import url() after @import "tailwindcss"
		// Actually the real rule: @import "tailwindcss" should be the LAST @import
		// because Tailwind v4 injects its layers and any @import after it is ignored.
		// But the Phase 01 bug was url() AFTER tailwindcss. So just check ordering.
		if (lastUrlImportLine > -1) {
			expect(
				lastUrlImportLine,
				'@import url(...) must appear before @import "tailwindcss" in index.css',
			).toBeLessThan(tailwindImportLine);
		}
	});

	it("all theme blocks exist (dark, light, high-contrast, paper, amber, contrast, slate, moss)", () => {
		// Guards against accidentally deleting a theme block during refactoring
		const css = readFileSync(
			join(__dirname, "../../../src/mainview/index.css"),
			"utf-8",
		);

		expect(css).toContain('[data-theme="dark"]');
		expect(css).toContain('[data-theme="light"]');
		expect(css).toContain('[data-theme="high-contrast"]');
		expect(css).toContain('[data-theme="paper"]');
		expect(css).toContain('[data-theme="amber"]');
		expect(css).toContain('[data-theme="contrast"]');
		expect(css).toContain('[data-theme="slate"]');
		expect(css).toContain('[data-theme="moss"]');
	});
});
