import { expect, test } from "@playwright/test";

test("SCAF-06 Tier 1: root element renders in Vite dev server", async ({
	page,
}) => {
	await page.goto("/");
	// Wait for the React root to be populated
	const root = page.locator("#root");
	await expect(root).toBeVisible();
	// Verify React rendered something inside the root
	const heading = page.locator("h1");
	await expect(heading).toHaveText("RoadRaven");
});
