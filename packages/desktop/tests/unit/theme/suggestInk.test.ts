// v0.8.3 Phase 5 (RC2): "Suggest fix" — step an ink's lightness away from
// its surface until the pair passes. Pure, over the Phase 0 contrast math.
import { describe, expect, it } from "vitest";
import {
	contrastRatio,
	parseColor,
	type RGB,
	suggestInk,
} from "../../../../../shared/contrast";

function rgb(hex: string | null): RGB {
	const c = parseColor(hex ?? undefined);
	if (!c) throw new Error(`${hex} is not a colour`);
	return [c[0], c[1], c[2]];
}

const WHITE: RGB = [255, 255, 255];

describe("suggestInk", () => {
	it("fixes #d1d1d1 on #ffffff to >= 4.5:1 with the hue preserved (grey stays grey)", () => {
		const out = suggestInk("#d1d1d1", "#ffffff", 4.5, "light");
		expect(out).toMatch(/^#[0-9a-f]{6}$/);
		const c = rgb(out);
		expect(c[0]).toBe(c[1]);
		expect(c[1]).toBe(c[2]);
		expect(contrastRatio(c, WHITE)).toBeGreaterThanOrEqual(4.5);
		// The smallest step that passes, not black.
		expect(c[0]).toBeGreaterThan(0);
	});

	it("returns null when no step within 50 can reach the minimum", () => {
		expect(suggestInk("#808080", "#808080", 21, "dark")).toBeNull();
		expect(suggestInk("#808080", "#7f7f7f", 21, "light")).toBeNull();
	});

	it("moves toward white on a dark surface", () => {
		const out = suggestInk("#333333", "#131313", 4.5, "dark");
		const c = rgb(out);
		expect(c[0]).toBeGreaterThan(0x33);
		expect(contrastRatio(c, rgb("#131313"))).toBeGreaterThanOrEqual(4.5);
	});

	it("keeps a coloured ink's hue while lightening it", () => {
		const out = suggestInk("#802020", "#131313", 4.5, "dark");
		const c = rgb(out);
		// Still red-dominant: mixing toward white never reorders the channels.
		expect(c[0]).toBeGreaterThan(c[1]);
		expect(c[1]).toBe(c[2]);
	});

	it("falls back to the other direction when the mode's direction cannot reach the minimum", () => {
		// A bright accent in a dark theme: white cannot reach 4.5:1 on it, black can.
		const out = suggestInk("#ffffff", "#ffa83d", 4.5, "dark");
		const c = rgb(out);
		expect(contrastRatio(c, rgb("#ffa83d"))).toBeGreaterThanOrEqual(4.5);
		expect(c[0]).toBeLessThan(0x80);
	});

	it("returns the ink itself when it already passes, and null for unparsable input", () => {
		expect(suggestInk("#ffffff", "#000000", 4.5, "dark")).toBe("#ffffff");
		expect(suggestInk("red", "#000000", 4.5, "dark")).toBeNull();
		expect(suggestInk("#ffffff", "", 4.5, "dark")).toBeNull();
	});
});
