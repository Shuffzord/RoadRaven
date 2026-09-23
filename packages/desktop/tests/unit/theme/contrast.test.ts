import { describe, expect, it } from "vitest";
import {
	composite,
	contrastRatio,
	lintTheme,
	mix,
	parseColor,
	relativeLuminance,
	resolveDerivedTokens,
	toHex,
	withAlpha,
} from "../../../../../shared/contrast";
import {
	CONTRAST_PAIRS,
	type ContrastPair,
	DERIVED_TOKENS,
	STATUS_IDS,
	STATUS_TOKENS,
	TEXT_NODE_TOKEN,
	THEME_TOKENS,
} from "../../../../../shared/themeContract";

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

// Phase 3: the small colour helpers the derivation table is built from.
describe("colour helpers", () => {
	it("mix blends per channel and rounds", () => {
		expect(mix([0, 0, 0], [255, 255, 255], 0)).toEqual([0, 0, 0]);
		expect(mix([0, 0, 0], [255, 255, 255], 1)).toEqual([255, 255, 255]);
		expect(mix([19, 19, 19], [224, 224, 224], 0.04)).toEqual([27, 27, 27]);
	});

	it("toHex and withAlpha write the forms the theme files use", () => {
		expect(toHex([74, 158, 255])).toBe("#4a9eff");
		expect(toHex([0, 0, 1])).toBe("#000001");
		expect(withAlpha([74, 158, 255], 0.12)).toBe("rgba(74, 158, 255, 0.12)");
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

// Phase 2: optional tokens the components read with a var() fallback are
// filled from the required ones before measuring, so the linter scores what
// the cascade paints when a theme leaves them unset.
describe("derived tokens", () => {
	it("covers exactly the node ink, the four card inks and the four badge inks", () => {
		expect(Object.keys(DERIVED_TOKENS).sort()).toEqual(
			[
				TEXT_NODE_TOKEN,
				...STATUS_IDS.map((s) => STATUS_TOKENS[s].card),
				...STATUS_IDS.map((s) => STATUS_TOKENS[s].fg),
			].sort(),
		);
	});

	it.each(
		STATUS_IDS,
	)("fills a missing %s card ink from the general status ink", (s) => {
		const out = resolveDerivedTokens({ [STATUS_TOKENS[s].ink]: "#4a9eff" });
		expect(out[STATUS_TOKENS[s].card]).toBe("#4a9eff");
	});

	it("a badge ink follows an explicit card ink before the general ink", () => {
		const out = resolveDerivedTokens({
			"--rv-status-completed": "#ffffff",
			"--rv-status-completed-card": "#000000",
		});
		expect(out["--rv-status-completed-fg"]).toBe("#000000");
	});

	it("fills a missing --rv-text-node from --rv-text-primary", () => {
		const out = resolveDerivedTokens({ "--rv-text-primary": "#e0e0e0" });
		expect(out[TEXT_NODE_TOKEN]).toBe("#e0e0e0");
	});

	it.each(
		STATUS_IDS,
	)("fills a missing %s badge ink from the general status ink when no card ink is set", (s) => {
		const out = resolveDerivedTokens({ [STATUS_TOKENS[s].ink]: "#4a9eff" });
		expect(out[STATUS_TOKENS[s].fg]).toBe("#4a9eff");
	});

	it("an explicit value wins over derivation", () => {
		const out = resolveDerivedTokens({
			"--rv-text-primary": "#d1d1d1",
			[TEXT_NODE_TOKEN]: "#000000",
			"--rv-status-completed": "#000000",
			"--rv-status-completed-fg": "#ffffff",
		});
		expect(out[TEXT_NODE_TOKEN]).toBe("#000000");
		expect(out["--rv-status-completed-fg"]).toBe("#ffffff");
	});

	it("leaves a token undefined when its source is missing too", () => {
		expect(resolveDerivedTokens({})).toEqual({});
	});

	it("lintTheme measures a derived ink instead of reporting it missing", () => {
		const [f] = lintTheme(
			{ "--rv-text-primary": "#000000", "--rv-bg-node": "#ffffff" },
			CONTRAST_PAIRS.filter((p) => p.id === "node-title"),
		);
		expect(f.reason).toBeUndefined();
		expect(f.ratio).toBeCloseTo(21, 6);
	});

	it("lintTheme on the required tokens plus the explicit derived ones finds no unmeasurable pair among them", () => {
		const required = THEME_TOKENS.filter(
			(t) => t.kind === "color" && t.tier === "required",
		).map((t) => t.name);
		const tokens = Object.fromEntries([
			...required.map((n) => [n, "#808080"]),
			[TEXT_NODE_TOKEN, "#000000"],
			...STATUS_IDS.map((s) => [STATUS_TOKENS[s].card, "#000000"]),
			...STATUS_IDS.map((s) => [STATUS_TOKENS[s].fg, "#ffffff"]),
		]);
		const touched = new Set([
			"node-title",
			...STATUS_IDS.map((s) => `badge-${s}`),
			...STATUS_IDS.map((s) => `stripe-${s}`),
			...STATUS_IDS.map((s) => `status-${s}-vs-surface`),
		]);
		const unmeasurable = lintTheme(tokens)
			.filter((f) => touched.has(f.pairId) && f.reason)
			// badge-<s> also needs the optional badge fill; only the node title
			// and the stripes are fully covered by the required set.
			.filter((f) => !f.reason?.includes("-bg"))
			.map((f) => `${f.pairId}: ${f.reason}`);
		expect(unmeasurable).toEqual([]);
	});
});
