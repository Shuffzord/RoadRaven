import type { Page } from "@playwright/test";
import { NODE_CARD_ATTR } from "../../../src/mainview/lib/domContract";

/** The canvas container (Canvas.tsx `role="application"` div). */
export const CONTAINER = '[role="application"]';

/**
 * A point whose topmost element is the rd3t <svg> itself: d3-zoom's filter
 * (hasInteractiveNodes) only accepts pan/zoom gestures that start there.
 * (dx, dy) reserves room so a drag from the point ends inside the canvas.
 *
 * Shared by canvas-focus.spec.ts and canvas-drag-perf.spec.ts.
 */
export async function emptyCanvasPoint(
	page: Page,
	dx = 0,
	dy = 0,
): Promise<{ x: number; y: number }> {
	return page.evaluate(
		([containerSel, offX, offY]) => {
			const container = document.querySelector(containerSel);
			if (!container) throw new Error("no canvas container");
			const r = container.getBoundingClientRect();
			for (let fy = 0.9; fy > 0.1; fy -= 0.1) {
				for (let fx = 0.1; fx < 0.9; fx += 0.1) {
					const x = r.left + r.width * fx;
					const y = r.top + r.height * fy;
					const endsInside =
						x + offX > r.left &&
						x + offX < r.right &&
						y + offY > r.top &&
						y + offY < r.bottom;
					if (
						endsInside &&
						document.elementFromPoint(x, y)?.classList.contains("rd3t-svg")
					) {
						return { x, y };
					}
				}
			}
			throw new Error("no empty canvas point found");
		},
		[CONTAINER, dx, dy] as const,
	);
}

/** Press-move-release drag starting on the empty svg background. */
export async function dragCanvas(
	page: Page,
	dx: number,
	dy: number,
): Promise<void> {
	const p = await emptyCanvasPoint(page, dx, dy);
	await page.mouse.move(p.x, p.y);
	await page.mouse.down();
	await page.mouse.move(p.x + dx, p.y + dy, { steps: 12 });
	await page.mouse.up();
}

/**
 * v0.8.4 Phase 3 — press on a node card, move by (dx, dy) screen px in
 * steps, release. The press lands in the card's upper-left area (title),
 * clear of the chevron button, which never starts a drag.
 */
export async function dragCard(
	page: Page,
	nodeId: string,
	dx: number,
	dy: number,
): Promise<void> {
	const box = await page
		.locator(`[${NODE_CARD_ATTR}="${nodeId}"]`)
		.boundingBox();
	if (!box) throw new Error(`card ${nodeId} has no box`);
	const x = box.x + box.width * 0.3;
	const y = box.y + box.height * 0.3;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y + dy, { steps: 12 });
	await page.mouse.up();
}
