import { describe, expect, it } from "vitest";
import {
	clampKnobs,
	KNOB_DEFAULTS,
	KNOB_RANGES,
	treeLayoutFor,
} from "../../../src/mainview/lib/layoutKnobs";

describe("clampKnobs", () => {
	it("returns defaults for undefined", () => {
		expect(clampKnobs(undefined)).toEqual(KNOB_DEFAULTS);
	});

	it("returns defaults for an empty object", () => {
		expect(clampKnobs({})).toEqual(KNOB_DEFAULTS);
	});

	it("falls back to defaults for string/NaN fields", () => {
		expect(
			clampKnobs({ siblingGap: "abc", depthGap: Number.NaN, density: 5 }),
		).toEqual(KNOB_DEFAULTS);
	});

	it("clamps out-of-range numbers into KNOB_RANGES", () => {
		expect(
			clampKnobs({ siblingGap: 99, depthGap: -5, density: "compact" }),
		).toEqual({
			siblingGap: KNOB_RANGES.siblingGap.max,
			depthGap: KNOB_RANGES.depthGap.min,
			density: "compact",
		});
	});

	it("accepts an in-range value unchanged", () => {
		expect(
			clampKnobs({ siblingGap: 1.6, depthGap: 1.4, density: "compact" }),
		).toEqual({ siblingGap: 1.6, depthGap: 1.4, density: "compact" });
	});
});

describe("treeLayoutFor", () => {
	it("TB at defaults: nodeSize.y scaled by depthGap 1.6, nonSiblings = siblings * 1.3", () => {
		expect(treeLayoutFor(KNOB_DEFAULTS, "TB")).toEqual({
			separation: { siblings: 1.2, nonSiblings: 1.2 * 1.3 },
			nodeSize: { x: 240, y: 160 },
		});
	});

	it("LR at defaults: nodeSize.x scaled by depthGap 1.6", () => {
		expect(treeLayoutFor(KNOB_DEFAULTS, "LR")).toEqual({
			separation: { siblings: 1.2, nonSiblings: 1.2 * 1.3 },
			nodeSize: { x: 384, y: 100 },
		});
	});

	it("TB at an extreme depthGap scales nodeSize.y only", () => {
		const knobs = {
			siblingGap: 2.0,
			depthGap: 2.0,
			density: "compact" as const,
		};
		expect(treeLayoutFor(knobs, "TB")).toEqual({
			separation: { siblings: 2.0, nonSiblings: 2.0 * 1.3 },
			nodeSize: { x: 240, y: 200 },
		});
	});

	it("LR at an extreme depthGap scales nodeSize.x only (axis swap)", () => {
		const knobs = {
			siblingGap: 0.8,
			depthGap: 0.6,
			density: "comfortable" as const,
		};
		expect(treeLayoutFor(knobs, "LR")).toEqual({
			separation: { siblings: 0.8, nonSiblings: 0.8 * 1.3 },
			nodeSize: { x: 144, y: 100 },
		});
	});

	it("returns a referentially equal object for equal (siblingGap, depthGap, orientation) inputs", () => {
		// Canvas.tsx also wraps this in useMemo on the three primitives — this
		// is the function's own half of that contract (Perf, Phase 2 brief):
		// a plain slider-unrelated re-render must not remount <Tree>.
		const a = treeLayoutFor(KNOB_DEFAULTS, "TB");
		const b = treeLayoutFor({ ...KNOB_DEFAULTS }, "TB");
		expect(b).toBe(a);
	});

	it("returns a new object once an input actually changes", () => {
		const a = treeLayoutFor(KNOB_DEFAULTS, "TB");
		const b = treeLayoutFor({ ...KNOB_DEFAULTS, siblingGap: 1.5 }, "TB");
		expect(b).not.toBe(a);
		expect(b.separation.siblings).toBe(1.5);
	});
});
