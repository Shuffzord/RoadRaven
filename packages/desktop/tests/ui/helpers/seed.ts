import type { Page } from "@playwright/test";

/**
 * Navigate to the dev-server root, wait for the `__ROADRAVEN_TEST__` seam to
 * be ready (App.tsx, DEV-only), then load the given schema through it.
 *
 * Shared by canvas-focus.spec.ts, keyboard-routing.spec.ts and
 * context-menu-50ms.spec.ts, which each need this exact goto + wait +
 * loadSchema sequence before their own post-seed assertions (node count,
 * waitForSelector, etc. — left in each spec).
 */
export async function seedSchema(page: Page, schema: unknown): Promise<void> {
	await page.goto("/");
	await page.waitForFunction(() =>
		Boolean(
			(window as { __ROADRAVEN_TEST__?: { loadSchema?: unknown } })
				.__ROADRAVEN_TEST__?.loadSchema,
		),
	);
	await page.evaluate(
		(s) =>
			(
				window as unknown as {
					__ROADRAVEN_TEST__: { loadSchema: (schema: unknown) => void };
				}
			).__ROADRAVEN_TEST__.loadSchema(s),
		schema,
	);
}
