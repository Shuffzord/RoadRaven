// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CONTRAST_PAIRS } from "../../../../../shared/themeContract";
import {
	readSampleInPage,
	renderReport,
	resolveSurface,
	SAMPLES,
	type SampleFinding,
	type SampleSpec,
	scoreSample,
} from "../../a11y/contrastSampler";

// The pure half of the rendered contrast gate (tests/a11y/contrast.spec.ts):
// the in-page reader against a jsdom fragment, the ancestor compositing, the
// scoring and the sample table itself. No browser, no build.

const spec = (over: Partial<SampleSpec> = {}): SampleSpec => ({
	id: "probe",
	pairId: "node-title",
	stage: "page",
	selector: "#ink",
	property: "color",
	paint: "behind",
	evidence: "test",
	...over,
});

describe("resolveSurface", () => {
	it("takes the nearest opaque layer as the backdrop", () => {
		expect(
			resolveSurface([
				"rgba(0, 0, 0, 0)",
				"rgb(255, 255, 255)",
				"rgb(0, 0, 0)",
			]),
		).toEqual([255, 255, 255]);
	});

	it("composites a translucent layer over the opaque one below it", () => {
		expect(
			resolveSurface(["rgba(74, 222, 128, 0.1)", "rgb(255, 255, 255)"]),
		).toEqual([237, 252, 242]);
	});

	it("composites several translucent layers nearest last", () => {
		expect(
			resolveSurface([
				"rgba(0, 0, 0, 0.5)",
				"rgba(255, 0, 0, 0.5)",
				"rgb(255, 255, 255)",
			]),
		).toEqual([128, 64, 64]);
	});

	it("skips empty, keyword and fully transparent layers", () => {
		expect(
			resolveSurface(["", "transparent", "rgba(9, 9, 9, 0)", "rgb(1, 2, 3)"]),
		).toEqual([1, 2, 3]);
	});

	it("is null when no layer is opaque", () => {
		expect(resolveSurface(["rgba(0, 0, 0, 0.5)", ""])).toBeNull();
	});
});

describe("readSampleInPage on a jsdom fragment", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div id="card" style="background-color: rgb(255, 255, 255)">
				<span id="ink" style="background-color: rgba(74, 222, 128, 0.1); color: rgb(74, 222, 128)">x</span>
				<div id="ring" style="outline-color: rgb(1, 2, 3); outline-style: solid; outline-width: 2px"></div>
				<div id="noring" style="outline-color: rgb(1, 2, 3); outline-style: none; outline-width: 2px"></div>
			</div>`;
	});

	it("reads the ink and every ancestor background, nearest first", () => {
		const reading = readSampleInPage(spec());
		expect(reading.ink).toBe("rgb(74, 222, 128)");
		expect(reading.layers.slice(0, 2)).toEqual([
			"rgba(74, 222, 128, 0.1)",
			"rgb(255, 255, 255)",
		]);
		// span, card, body, html
		expect(reading.layers).toHaveLength(4);
		expect(reading.reason).toBeUndefined();
	});

	it("starts the walk at the parent for ink painted around the element", () => {
		const reading = readSampleInPage(
			spec({ selector: "#ring", property: "outline-color", paint: "around" }),
		);
		expect(reading.ink).toBe("rgb(1, 2, 3)");
		expect(reading.layers[0]).toBe("rgb(255, 255, 255)");
		expect(reading.layers).toHaveLength(3);
	});

	it("reports an outline that is not drawn instead of scoring its colour", () => {
		const reading = readSampleInPage(
			spec({ selector: "#noring", property: "outline-color", paint: "around" }),
		);
		expect(reading.ink).toBeNull();
		expect(reading.reason).toBe("no outline drawn");
	});

	it("reports a selector that matches nothing", () => {
		const reading = readSampleInPage(spec({ selector: "#missing" }));
		expect(reading).toEqual({
			id: "probe",
			ink: null,
			layers: [],
			reason: "element not found",
		});
	});
});

describe("scoreSample", () => {
	it("scores the Contrast title the way the cascade paints it (RC1: 1.53:1)", () => {
		const finding = scoreSample("contrast", spec(), {
			id: "probe",
			ink: "rgb(209, 209, 209)",
			layers: ["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)", "rgb(10, 10, 10)"],
		});
		expect(finding).toMatchObject({
			theme: "contrast",
			sampleId: "probe",
			pairId: "node-title",
			tier: "required",
			min: 4.5,
			ink: "#d1d1d1",
			surface: "#ffffff",
			pass: false,
		});
		expect(finding.ratio).toBeCloseTo(1.53, 2);
	});

	it("composites a translucent ink over the resolved surface", () => {
		const finding = scoreSample("dark", spec(), {
			id: "probe",
			ink: "rgba(255, 255, 255, 0.5)",
			layers: ["rgb(0, 0, 0)"],
		});
		expect(finding.ink).toBe("#808080");
		expect(finding.surface).toBe("#000000");
	});

	it("fails with a reason instead of a ratio when nothing was measured", () => {
		const missing = scoreSample("dark", spec(), {
			id: "probe",
			ink: null,
			layers: [],
			reason: "element not found",
		});
		expect(missing).toMatchObject({
			pass: false,
			ratio: 0,
			reason: "element not found",
		});
		const floating = scoreSample("dark", spec(), {
			id: "probe",
			ink: "rgb(1, 2, 3)",
			layers: ["rgba(0, 0, 0, 0.2)"],
		});
		expect(floating.pass).toBe(false);
		expect(floating.reason).toMatch(/no opaque background/);
	});

	it("rejects a sample that names an unregistered pair", () => {
		expect(() =>
			scoreSample("dark", spec({ pairId: "nope" }), {
				id: "probe",
				ink: "rgb(0, 0, 0)",
				layers: ["rgb(255, 255, 255)"],
			}),
		).toThrow(/unknown pair nope/);
	});
});

describe("SAMPLES table", () => {
	it("has unique ids and only registered pairs", () => {
		const ids = SAMPLES.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		const pairIds = new Set(CONTRAST_PAIRS.map((p) => p.id));
		for (const s of SAMPLES) {
			expect(pairIds.has(s.pairId), `${s.id} -> ${s.pairId}`).toBe(true);
		}
	});

	it("covers the surfaces the phase brief requires", () => {
		const ids = new Set(SAMPLES.map((s) => s.id));
		for (const id of [
			"node-title",
			"badge-completed",
			"stripe-completed",
			"chevron-text",
			"document-chip",
			"status-bar-version",
			"sidebar-outline-row",
			"menu-item",
			"focus-ring",
		]) {
			expect(ids.has(id), id).toBe(true);
		}
		const stripe = SAMPLES.find((s) => s.id === "stripe-completed");
		expect(stripe).toMatchObject({
			pseudo: "::before",
			property: "background-color",
		});
		expect(SAMPLES.find((s) => s.id === "focus-ring")?.paint).toBe("around");
	});
});

describe("renderReport", () => {
	const row = (over: Partial<SampleFinding>): SampleFinding => ({
		theme: "moss",
		sampleId: "node-title",
		pairId: "node-title",
		tier: "required",
		min: 4.5,
		ratio: 3,
		ink: "#858472",
		surface: "#eae5d3",
		pass: false,
		...over,
	});

	it("marks every row pass, known, NEW or advisory", () => {
		const md = renderReport(
			[
				row({ sampleId: "known", ratio: 3 }),
				row({ sampleId: "new", ratio: 2.5 }),
				row({ sampleId: "ok", ratio: 7, pass: true }),
				row({ sampleId: "soft", tier: "advisory", ratio: 1.2 }),
				row({ sampleId: "gone", ratio: 0, reason: "element not found" }),
			],
			new Set(["moss/known"]),
		);
		expect(md).toContain(
			"| moss | known | node-title | required | #858472 | #eae5d3 | 3.00:1 | 4.5 | known |",
		);
		expect(md).toContain("| 2.50:1 | 4.5 | NEW |");
		expect(md).toContain("| 7.00:1 | 4.5 | pass |");
		expect(md).toContain("| 1.20:1 | 4.5 | advisory |");
		expect(md).toContain("| ?? (element not found) | 4.5 | NEW |");
	});
});
