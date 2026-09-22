import { describe, expect, it } from "vitest";
import {
	composite,
	contrastRatio,
	lintTheme,
	parseColor,
	parseThemeBlocks,
	relativeLuminance,
} from "../../../../../shared/contrast";
import type { ContrastPair } from "../../../../../shared/themeContract";

describe("parseColor", () => {
	it("parses 6-digit hex", () => {
		expect(parseColor("#4a9eff")).toEqual([74, 158, 255, 1]);
		expect(parseColor("#FFFFFF")).toEqual([255, 255, 255, 1]);
	});

	it("parses rgb() and rgba()", () => {
		expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
		expect(parseColor("rgba(74, 222, 128, 0.1)")).toEqual([74, 222, 128, 0.1]);
	});

	it("returns null for anything else", () => {
		expect(parseColor("hotpink")).toBeNull();
		expect(parseColor("#fff")).toBeNull();
		expect(parseColor("none")).toBeNull();
		expect(parseColor(undefined)).toBeNull();
	});
});

describe("WCAG 2.x math", () => {
	it("black on white is 21:1", () => {
		expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6);
		expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 6);
	});

	it("#d1d1d1 on #ffffff is about 1.53:1 (the Contrast-theme title bug)", () => {
		expect(contrastRatio([209, 209, 209], [255, 255, 255])).toBeCloseTo(
			1.53,
			2,
		);
	});

	it("relative luminance of white is 1 and of black is 0", () => {
		expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
		expect(relativeLuminance([0, 0, 0])).toBe(0);
	});

	it("composites rgba(74,222,128,0.1) over white", () => {
		expect(composite([74, 222, 128, 0.1], [255, 255, 255])).toEqual([
			237, 252, 242,
		]);
	});

	it("compositing an opaque colour returns it unchanged", () => {
		expect(composite([10, 20, 30, 1], [255, 255, 255])).toEqual([10, 20, 30]);
	});
});

describe("lintTheme", () => {
	const pair = (over: Partial<ContrastPair> = {}): ContrastPair => ({
		id: "p",
		label: "test pair",
		ink: "--ink",
		surface: ["--bg"],
		min: 4.5,
		tier: "required",
		evidence: "contrast.test.ts",
		...over,
	});

	it("passes black on white and fails grey on white", () => {
		const [pass] = lintTheme({ "--ink": "#000000", "--bg": "#ffffff" }, [
			pair(),
		]);
		expect(pass).toMatchObject({
			pairId: "p",
			ink: "#000000",
			surface: "#ffffff",
			min: 4.5,
			tier: "required",
			pass: true,
		});
		expect(pass.ratio).toBeCloseTo(21, 6);

		const [fail] = lintTheme({ "--ink": "#d1d1d1", "--bg": "#ffffff" }, [
			pair(),
		]);
		expect(fail.pass).toBe(false);
		expect(fail.ratio).toBeCloseTo(1.53, 2);
	});

	it("composites a translucent badge fill over the card before measuring", () => {
		const [f] = lintTheme(
			{
				"--ink": "#4ade80",
				"--card": "#ffffff",
				"--fill": "rgba(74, 222, 128, 0.1)",
			},
			[pair({ surface: ["--card", "--fill"] })],
		);
		expect(f.surface).toBe("#edfcf2");
		expect(f.ratio).toBeCloseTo(contrastRatio([74, 222, 128], [237, 252, 242]));
	});

	it("reports an unparsable or missing token as a failing finding with a reason", () => {
		const [bad] = lintTheme({ "--ink": "hotpink", "--bg": "#ffffff" }, [
			pair(),
		]);
		expect(bad.pass).toBe(false);
		expect(bad.reason).toContain("hotpink");

		const [missing] = lintTheme({ "--ink": "#000000" }, [pair()]);
		expect(missing.pass).toBe(false);
		expect(missing.reason).toContain("--bg");
	});

	it("keeps a pair's own min and tier on the finding", () => {
		const [f] = lintTheme({ "--ink": "#777777", "--bg": "#000000" }, [
			pair({ min: 2, tier: "advisory" }),
		]);
		expect(f).toMatchObject({ min: 2, tier: "advisory", pass: true });
	});
});

describe("parseThemeBlocks", () => {
	it("reads [data-theme] blocks, including the :root-joined dark block", () => {
		const css = `
:root,
[data-theme="dark"] {
	--rv-bg-base: #131313;
	--rv-shadow-node:
		0 1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
}
[data-theme="paper"] {
	--rv-bg-base: #f6f3ec;
}
[data-theme="paper"] h1,
[data-theme="paper"] .rv-heading {
	font-family: serif;
}
[data-theme="paper"] {
	--rv-font-sans: monospace;
}
`;
		expect(parseThemeBlocks(css)).toEqual({
			dark: {
				"--rv-bg-base": "#131313",
				"--rv-shadow-node":
					"0 1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
			},
			paper: { "--rv-bg-base": "#f6f3ec", "--rv-font-sans": "monospace" },
		});
	});
});
