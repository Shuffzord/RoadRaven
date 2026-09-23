import { existsSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
	CREATE_THEME_LABEL,
	EDIT_THEME_LABEL,
	EDITOR_ADVANCED_LABEL,
	EDITOR_CHIP_PAIR_ATTR,
	EDITOR_CHIP_STATUS_ATTR,
	EDITOR_CHIP_TESTID,
	EDITOR_DIALOG_LABEL,
	EDITOR_FIELD_ATTR,
	EDITOR_HIDE_LABEL,
	EDITOR_SUGGEST_FIX_LABEL,
	editorPillLabel,
	THEME_NAME_LABEL,
} from "../../src/mainview/lib/domContract";
import { getBuiltInTheme, THEME_IDS } from "../../src/mainview/themes";
import { CARD, selectTheme } from "./contrastSampler";

// Theme editor (v0.8.3 Phase 5, RC1 / RC2) against the production bundle on
// vite preview 4173 — see audit.spec.ts for the pre-condition and the pass
// criterion. Outside Electrobun there is no RPC: "Edit…" on a built-in still
// prompts for a name and opens the editor on an in-memory copy (the same
// copy Bun's duplicateTheme would write), and the autosave reports that it
// could not save. The paint path, the chips and the dialog are the real ones.
//
// Selectors: every editor selector is a contract constant from
// src/mainview/lib/domContract.ts; the node title is the contrastSampler's
// `node-title` sample (`${CARD} > span.block`, RoadmapNode.tsx:360); the
// Preferences cog is TopBar.tsx:199 (aria-label "Preferences", pre-Phase 5).

const DIST_DIR = join(process.cwd(), "dist");
test.skip(
	!existsSync(DIST_DIR),
	"packages/desktop/dist/ missing — run `bun run --cwd packages/desktop build` first",
);

const NODE_TITLE = `${CARD} > span.block`;
const TEXT_PRIMARY = `input[${EDITOR_FIELD_ATTR}="--rv-text-primary"]`;
// The node-title pair shows under both of its tokens (the card as surface,
// the card text as ink); the ink field is where "Suggest fix" lives.
const CARD_TEXT_FIELD = `[${EDITOR_FIELD_ATTR}="--rv-text-node"]`;
const chipSelector = (pairId: string) =>
	`[data-testid="${EDITOR_CHIP_TESTID}"][${EDITOR_CHIP_PAIR_ATTR}="${pairId}"]`;

async function loadHelloWorld(page: Page): Promise<void> {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByRole("button", { name: "Hello World" }).click();
	await page.waitForSelector('[role="application"]', { timeout: 5000 });
	await page.waitForSelector(CARD, { timeout: 5000 });
}

/** Preferences → Edit… on the painted built-in → name prompt → editor on the copy. */
async function openEditorOnCopy(page: Page, themeId: string): Promise<string> {
	const name = `${getBuiltInTheme(themeId)?.meta.name} copy`;
	await page.getByRole("button", { name: "Preferences" }).click();
	await page.getByRole("button", { name: EDIT_THEME_LABEL }).click();
	await expect(page.getByLabel(THEME_NAME_LABEL)).toHaveValue(name);
	await page.getByRole("button", { name: CREATE_THEME_LABEL }).click();
	const editor = page.getByRole("dialog", { name: EDITOR_DIALOG_LABEL });
	await expect(editor).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Preferences" })).toBeHidden();
	return name;
}

async function titleColor(page: Page): Promise<string> {
	return page
		.locator(NODE_TITLE)
		.first()
		.evaluate((el) => getComputedStyle(el).color);
}

async function auditEditor(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.exclude("svg .rd3t-link")
		.analyze();
	const blockers = results.violations.filter(
		(v) => v.impact === "critical" || v.impact === "serious",
	);
	expect(
		blockers,
		`[${label}] severity-blocker accessibility violations:\n${JSON.stringify(blockers, null, 2)}`,
	).toEqual([]);
}

test.describe("Theme editor (production bundle, vite preview port 4173)", () => {
	test("edits the canvas live, shows the registry verdicts, suggests a fix, hides to a pill", async ({
		page,
	}) => {
		await loadHelloWorld(page);
		const before = await titleColor(page);
		const name = await openEditorOnCopy(page, "amber");
		const editor = page.getByRole("dialog", { name: EDITOR_DIALOG_LABEL });

		// The canvas is the preview: the node title follows text-primary
		// (text-node is derived from it) as soon as the hex is accepted.
		await page.locator(TEXT_PRIMARY).fill("#ff0000");
		await expect.poll(() => titleColor(page)).toBe("rgb(255, 0, 0)");

		// Red on Amber's card is 4.4:1 — the node-title pair (ink: text-node,
		// under Advanced → Text → Card text) fails, with the same verdict CI
		// would give.
		await editor.getByRole("button", { name: EDITOR_ADVANCED_LABEL }).click();
		const titleChip = editor
			.locator(CARD_TEXT_FIELD)
			.locator(chipSelector("node-title"));
		await expect(titleChip).toHaveAttribute(EDITOR_CHIP_STATUS_ATTR, "fail");
		await expect(titleChip).toHaveText("fail");

		// Suggest fix on that pair steps the ink until it passes.
		await titleChip
			.locator("xpath=ancestor::li[1]")
			.getByRole("button", { name: EDITOR_SUGGEST_FIX_LABEL })
			.click();
		await expect(titleChip).toHaveAttribute(EDITOR_CHIP_STATUS_ATTR, "pass");
		const fixed = await titleColor(page);
		expect(fixed).not.toBe(before);
		expect(fixed).not.toBe("rgb(255, 0, 0)");

		// Hide: the dialog goes, the pill stays, the edits stay painted.
		await editor.getByRole("button", { name: EDITOR_HIDE_LABEL }).click();
		await expect(editor).toBeHidden();
		const pill = page.getByRole("button", { name: editorPillLabel(name) });
		await expect(pill).toBeVisible();
		expect(await titleColor(page)).toBe(fixed);

		// Show: back, still on the same draft.
		await pill.click();
		await expect(editor).toBeVisible();
		await expect(pill).toBeHidden();
		expect(await titleColor(page)).toBe(fixed);
	});

	// The editor itself must pass axe with every chip on screen, on a copy of
	// each built-in (the dialog is painted in the theme being edited).
	for (const theme of THEME_IDS) {
		test(`editor open on a copy of '${theme}' with Advanced expanded passes WCAG 2.1 AA`, async ({
			page,
		}) => {
			await loadHelloWorld(page);
			await selectTheme(page, theme);
			await openEditorOnCopy(page, theme);
			const editor = page.getByRole("dialog", { name: EDITOR_DIALOG_LABEL });
			await editor.getByRole("button", { name: EDITOR_ADVANCED_LABEL }).click();
			await expect(
				editor.locator(CARD_TEXT_FIELD).locator(chipSelector("node-title")),
			).toBeVisible();
			await page.waitForTimeout(200);
			await auditEditor(page, `editor-${theme}`);
		});
	}
});
