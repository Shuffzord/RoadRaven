import { existsSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Pre-condition: `bun run --cwd packages/desktop build` has produced
// packages/desktop/dist/. Vite preview serves dist/ on port 4173.
//
// Pass criterion (D-20): zero severity-blocker findings (`critical` or `serious`
// axe impacts). `moderate` and `minor` findings are tracked in 05-A11Y-AUDIT.md
// but do not fail the gate.

const DIST_DIR = join(process.cwd(), "dist");
const hasDist = existsSync(DIST_DIR);

test.skip(
	!hasDist,
	"packages/desktop/dist/ missing — run `bun run --cwd packages/desktop build` first",
);

test.describe("Accessibility audit (production bundle)", () => {
	test("Welcome screen passes WCAG 2.1 AA (no critical/serious violations)", async ({
		page,
	}) => {
		await page.goto("/");
		// Wait for app shell to render — welcome screen has the [data-welcome] hook
		// (or fall back to body visibility if that selector doesn't exist yet).
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();

		const blockers = results.violations.filter(
			(v) => v.impact === "critical" || v.impact === "serious",
		);

		// Log moderate/minor for the audit doc, but do not fail
		const tracked = results.violations.filter(
			(v) => v.impact === "moderate" || v.impact === "minor",
		);
		if (tracked.length > 0) {
			console.warn(
				`axe: ${tracked.length} moderate/minor findings (tracked, non-blocking):`,
				tracked.map((v) => `${v.id} (${v.impact})`).join(", "),
			);
		}

		expect(
			blockers,
			`Severity-blocker accessibility violations:\n${JSON.stringify(blockers, null, 2)}`,
		).toEqual([]);
	});
});
