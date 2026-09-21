import { describe, expect, it } from "vitest";
import {
	clampZoom,
	SCALE_EXTENT,
} from "../../../src/mainview/lib/viewportMath";

// v0.8.1 Phase 1 (RC7) — .planning/v0.8.1-canvas-focus-PLAN.md.
// The shared zoom extent that both <Tree scaleExtent> and every programmatic
// zoom target must agree on. Before this module existed, Canvas asked for
// FOCUS_ZOOM = 1.6 while react-d3-tree silently clamped the rendered scale to
// 1, so the translate was computed for a zoom that never happened.

describe("SCALE_EXTENT", () => {
	it("keeps max zoom at 1 (user decision D4)", () => {
		expect(SCALE_EXTENT).toEqual({ min: 0.1, max: 1 });
	});
});

describe("clampZoom", () => {
	it("returns a zoom inside the extent unchanged", () => {
		expect(clampZoom(0.8)).toBe(0.8);
	});

	it("clamps a zoom above the maximum", () => {
		expect(clampZoom(1.6)).toBe(SCALE_EXTENT.max);
	});

	it("clamps a zoom below the minimum", () => {
		expect(clampZoom(0.01)).toBe(SCALE_EXTENT.min);
	});

	it("leaves the extent boundaries themselves alone", () => {
		expect(clampZoom(SCALE_EXTENT.min)).toBe(SCALE_EXTENT.min);
		expect(clampZoom(SCALE_EXTENT.max)).toBe(SCALE_EXTENT.max);
	});
});
