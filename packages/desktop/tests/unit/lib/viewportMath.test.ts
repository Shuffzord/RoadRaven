import { describe, expect, it } from "vitest";
import {
	clampZoom,
	computeFit,
	computePanDelta,
	SCALE_EXTENT,
	type ScreenRect,
} from "../../../src/mainview/lib/viewportMath";

// v0.8.1 Phase 1 (RC7) — .planning/v0.8.1-canvas-focus-PLAN.md.
// The shared zoom extent that both <Tree scaleExtent> and every programmatic
// zoom target must agree on. Before this module existed, Canvas asked for
// FOCUS_ZOOM = 1.6 while react-d3-tree silently clamped the rendered scale to
// 1, so the translate was computed for a zoom that never happened.

describe("clampZoom", () => {
	it.each([
		["inside the extent, unchanged", 0.8, 0.8],
		["above the maximum, clamped", 1.6, SCALE_EXTENT.max],
		["below the minimum, clamped", 0.01, SCALE_EXTENT.min],
		["at the minimum boundary, unchanged", SCALE_EXTENT.min, SCALE_EXTENT.min],
		["at the maximum boundary, unchanged", SCALE_EXTENT.max, SCALE_EXTENT.max],
	])("%s", (_label, input, expected) => {
		expect(clampZoom(input)).toBe(expected);
	});
});

// v0.8.1 Phase 2 (RC2, RC11) — .planning/v0.8.1-canvas-focus-PLAN.md.
// Both functions take plain SCREEN rectangles measured from the DOM, which is
// why LR vs TB, the zoom factor and the card's size inside its foreignObject
// stop mattering: react-d3-tree renders horizontal nodes at translate(y, x)
// (RC2) and the card's visual centre sits ~16 local px above the layout point
// the old maths anchored on (RC11). A measured rect has neither problem.

/** The canvas container in every case below: 800x600 at the origin. */
const CONTAINER: ScreenRect = { left: 0, top: 0, right: 800, bottom: 600 };
// Comfort zone = middle 50% => x 200..600, y 150..450.

/** A card of `w` x `h` screen px centred on (cx, cy). */
function cardAt(cx: number, cy: number, w = 40, h = 20): ScreenRect {
	return {
		left: cx - w / 2,
		top: cy - h / 2,
		right: cx + w / 2,
		bottom: cy + h / 2,
	};
}

describe("computePanDelta", () => {
	it("does not move a card whose centre is already in the comfort zone", () => {
		expect(computePanDelta(cardAt(400, 300), CONTAINER, "nearest")).toEqual({
			dx: 0,
			dy: 0,
		});
	});

	it("leaves a card exactly on the zone boundary alone", () => {
		expect(computePanDelta(cardAt(600, 450), CONTAINER, "nearest")).toEqual({
			dx: 0,
			dy: 0,
		});
	});

	it.each([
		["past the right edge", cardAt(700, 300), { dx: -100, dy: 0 }],
		["past the left edge", cardAt(100, 300), { dx: 100, dy: 0 }],
		["above the zone", cardAt(400, 50), { dx: 0, dy: 100 }],
		["below the zone", cardAt(400, 550), { dx: 0, dy: -100 }],
	])("pulls a card %s back to the zone edge", (_label, card, expected) => {
		expect(computePanDelta(card, CONTAINER, "nearest")).toEqual(expected);
	});

	it("corrects both axes at once", () => {
		expect(computePanDelta(cardAt(900, 700), CONTAINER, "nearest")).toEqual({
			dx: -300,
			dy: -250,
		});
	});

	it("works against a container that is not at the viewport origin", () => {
		// The real container sits below the header and right of the sidebar.
		const offset: ScreenRect = { left: 220, top: 50, right: 940, bottom: 688 };
		// zone x 400..760, y 209.5..528.5
		expect(computePanDelta(cardAt(800, 300), offset, "nearest")).toEqual({
			dx: -40,
			dy: 0,
		});
	});

	it("only looks at the card's centre, so a card wider than the zone is left alone", () => {
		// 900px wide — wider than the 400px comfort zone and than nothing else
		// could satisfy. Anchoring on the centre keeps the answer stable.
		expect(
			computePanDelta(cardAt(400, 300, 900, 20), CONTAINER, "nearest"),
		).toEqual({ dx: 0, dy: 0 });
	});

	it("center puts the card centre on the container centre", () => {
		expect(computePanDelta(cardAt(700, 200), CONTAINER, "center")).toEqual({
			dx: -300,
			dy: 100,
		});
	});

	it("center moves a card that nearest would have left alone", () => {
		expect(computePanDelta(cardAt(550, 400), CONTAINER, "nearest")).toEqual({
			dx: 0,
			dy: 0,
		});
		expect(computePanDelta(cardAt(550, 400), CONTAINER, "center")).toEqual({
			dx: -150,
			dy: -100,
		});
	});

	it("none never moves the camera", () => {
		expect(computePanDelta(cardAt(5000, 5000), CONTAINER, "none")).toEqual({
			dx: 0,
			dy: 0,
		});
	});
});

describe("computeFit", () => {
	const IDENTITY = { x: 0, y: 0, k: 1 };

	it("returns null when no card is mounted", () => {
		expect(computeFit([], CONTAINER, IDENTITY)).toBeNull();
	});

	it("caps a small tree at the maximum zoom and centres it", () => {
		// A single 40x40 card would fit at k=12.75; the tree never renders
		// above SCALE_EXTENT.max, so the translate must be computed for that.
		const fit = computeFit([cardAt(400, 300, 40, 40)], CONTAINER, IDENTITY);

		expect(fit).not.toBeNull();
		expect(fit?.zoom).toBe(SCALE_EXTENT.max);
		expect(fit?.translate.x).toBeCloseTo(0, 6);
		expect(fit?.translate.y).toBeCloseTo(0, 6);
	});

	it("keeps the 0.2 floor for a tree far wider than the viewport", () => {
		const wide: ScreenRect = { left: 0, top: 290, right: 10000, bottom: 310 };

		expect(computeFit([wide], CONTAINER, IDENTITY)?.zoom).toBe(0.2);
	});

	it("unions every card, so the box follows the widest pair", () => {
		const fit = computeFit(
			[cardAt(100, 300, 40, 40), cardAt(500, 300, 40, 40)],
			CONTAINER,
			IDENTITY,
		);

		// Union spans x 80..520 (440 wide), y 280..320 (40 tall):
		// zoom = min(680/440, 510/40) = 1.545… -> clamped to 1.
		expect(fit?.zoom).toBe(SCALE_EXTENT.max);
		// Box centre is (300, 300); container centre is (400, 300).
		expect(fit?.translate.x).toBeCloseTo(100, 6);
		expect(fit?.translate.y).toBeCloseTo(0, 6);
	});

	it("converts screen rects through a non-identity transform (RC2, RC11)", () => {
		const container: ScreenRect = {
			left: 20,
			top: 10,
			right: 820,
			bottom: 610,
		};
		const transform = { x: 100, y: 50, k: 0.5 };
		// Screen 220..420 x 210..310 -> local 200..600 x 300..500.
		const card: ScreenRect = { left: 220, top: 210, right: 420, bottom: 310 };

		const fit = computeFit([card], container, transform);

		// zoom = min(800*0.85/400, 600*0.85/200) = 1.7 -> clamped to 1.
		expect(fit?.zoom).toBe(SCALE_EXTENT.max);
		// Local centre (400, 400) onto the container centre (400, 300).
		expect(fit?.translate.x).toBeCloseTo(0, 6);
		expect(fit?.translate.y).toBeCloseTo(-100, 6);
	});

	it("never returns a zoom outside the shared extent", () => {
		const huge: ScreenRect = {
			left: -5000,
			top: -5000,
			right: 5000,
			bottom: 5000,
		};
		const tiny = cardAt(400, 300, 1, 1);

		for (const rect of [huge, tiny]) {
			const zoom = computeFit([rect], CONTAINER, IDENTITY)?.zoom ?? 0;
			expect(zoom).toBeGreaterThanOrEqual(SCALE_EXTENT.min);
			expect(zoom).toBeLessThanOrEqual(SCALE_EXTENT.max);
		}
	});
});
