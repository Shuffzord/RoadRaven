import { describe, expect, it } from "vitest";
import pkg from "../../../package.json" with { type: "json" };
import { PROMO_COPY } from "../../../scripts/screenshots/copy";
import { focalPosition } from "../../../scripts/screenshots/focal";
import {
	FORMAT_IDS,
	PROMO_FORMATS,
	releaseVersion,
} from "../../../scripts/screenshots/promo";

describe("PROMO_FORMATS", () => {
	it("has the four documented formats and sizes", () => {
		expect(
			PROMO_FORMATS.map(({ id, width, height }) => [id, width, height]),
		).toEqual([
			["readme-hero", 1600, 900],
			["social-card", 1200, 630],
			["square-feature", 1080, 1080],
			["release-card", 1200, 630],
		]);
		expect(FORMAT_IDS).toEqual(PROMO_FORMATS.map((format) => format.id));
	});
});

describe("focalPosition", () => {
	const viewport = { width: 1600, height: 1200 };

	it("maps a rect centred in the viewport to 50/50", () => {
		const rect = { x: 700, y: 550, width: 200, height: 100 };
		expect(focalPosition(rect, viewport)).toEqual({ x: 50, y: 50 });
	});

	it("maps a top-left rect toward 0/0", () => {
		const rect = { x: 0, y: 0, width: 160, height: 120 };
		expect(focalPosition(rect, viewport)).toEqual({ x: 5, y: 5 });
	});

	it("clamps a rect outside the viewport to 0-100", () => {
		expect(
			focalPosition({ x: -500, y: 2000, width: 100, height: 100 }, viewport),
		).toEqual({ x: 0, y: 100 });
	});
});

describe("PROMO_COPY", () => {
	it.each(FORMAT_IDS)("%s has two differing options and a valid pick", (id) => {
		const entry = PROMO_COPY[id];
		expect([0, 1]).toContain(entry.picked);
		expect(entry.options).toHaveLength(2);
		expect(entry.options[0]).not.toEqual(entry.options[1]);
		expect(entry.options[0].headline).not.toBe(entry.options[1].headline);
	});

	it("release-card options carry one to three highlights", () => {
		for (const option of PROMO_COPY["release-card"].options) {
			expect(option.highlights?.length ?? 0).toBeGreaterThanOrEqual(1);
			expect(option.highlights?.length ?? 0).toBeLessThanOrEqual(3);
		}
	});
});

describe("releaseVersion", () => {
	it("is packages/desktop/package.json's version", () => {
		expect(releaseVersion()).toBe(pkg.version);
	});
});
