/** @vitest-environment jsdom */
// v0.8.4 Phase 3 — custom layout connectors. `stepPath` must reproduce
// react-d3-tree's own `pathFunc="step"` (Link/index.js `drawStepPath`)
// exactly, so turning the feature on with no offsets changes no connector.
// Proven against the library itself: the same tree is rendered once with
// the built-in "step" and once with `stepPath`, and every `d` must match.
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import Tree from "react-d3-tree";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	offsetLink,
	stepEndpoints,
	stepPath,
} from "../../../src/mainview/lib/linkPath";

afterEach(cleanup);

// d3-zoom (bound by <Tree> on mount) reads the svg's width/height.baseVal,
// which jsdom does not implement. Stubbed for this file only.
const SIZE = { baseVal: { value: 800 } };
beforeAll(() => {
	for (const prop of ["width", "height"] as const) {
		Object.defineProperty(SVGElement.prototype, prop, {
			configurable: true,
			get: () => SIZE,
		});
	}
});
afterAll(() => {
	for (const prop of ["width", "height"] as const) {
		delete (SVGElement.prototype as unknown as Record<string, unknown>)[prop];
	}
});

const DATA = {
	name: "root",
	children: [
		{ name: "a", children: [{ name: "a1" }, { name: "a2" }] },
		{ name: "b" },
		{ name: "c", children: [{ name: "c1" }] },
	],
};

type TreeOrientation = "vertical" | "horizontal";

function renderedPaths(
	orientation: TreeOrientation,
	pathFunc: unknown,
): string[] {
	const { container, unmount } = render(
		createElement(Tree, {
			data: DATA,
			orientation,
			pathFunc: pathFunc as "step",
			nodeSize: { x: 240, y: 100 },
			separation: { siblings: 1.1, nonSiblings: 1.43 },
			enableLegacyTransitions: false,
		}),
	);
	const ds = Array.from(container.querySelectorAll("path.rd3t-link")).map(
		(p) => p.getAttribute("d") ?? "",
	);
	unmount();
	return ds;
}

describe("stepPath — identical to react-d3-tree's step path", () => {
	for (const [treeOrientation, orientation] of [
		["vertical", "TB"],
		["horizontal", "LR"],
	] as const) {
		it(`matches the library for every link (${treeOrientation})`, () => {
			const library = renderedPaths(treeOrientation, "step");
			const ours = renderedPaths(
				treeOrientation,
				(link: {
					source: { x: number; y: number };
					target: { x: number; y: number };
				}) => stepPath(link.source, link.target, orientation),
			);
			expect(library.length).toBe(6);
			expect(ours).toEqual(library);
		});
	}

	it("formats a vertical link like drawStepPath (Link/index.js:44-49)", () => {
		expect(stepPath({ x: 0, y: 0 }, { x: 120, y: 100 }, "TB")).toBe(
			"M0,0 V50 H120 V100",
		);
	});

	it("formats a horizontal link like drawStepPath, axes swapped", () => {
		expect(stepPath({ x: 0, y: 0 }, { x: 120, y: 100 }, "LR")).toBe(
			"M0,0 H50 V120 H100",
		);
	});
});

describe("offsetLink", () => {
	const link = { source: { x: 0, y: 0 }, target: { x: 120, y: 100 } };

	it("shifts both endpoints by their screen offsets (TB: x is horizontal)", () => {
		expect(
			offsetLink(
				link,
				{ source: { dx: 5, dy: 6 }, target: { dx: -10, dy: 20 } },
				"TB",
			),
		).toEqual({ source: { x: 5, y: 6 }, target: { x: 110, y: 120 } });
	});

	it("maps a screen offset onto the swapped axes in LR (layout x is vertical)", () => {
		expect(
			offsetLink(
				link,
				{ source: { dx: 0, dy: 0 }, target: { dx: 30, dy: 40 } },
				"LR",
			),
		).toEqual({ source: { x: 0, y: 0 }, target: { x: 160, y: 130 } });
	});

	it("is the identity with zero offsets", () => {
		const zero = { dx: 0, dy: 0 };
		expect(offsetLink(link, { source: zero, target: zero }, "TB")).toEqual(
			link,
		);
	});
});

describe("stepEndpoints — the inverse of stepPath", () => {
	for (const orientation of ["TB", "LR"] as const) {
		it(`recovers source and target from a ${orientation} path`, () => {
			const source = { x: -12.5, y: 3 };
			const target = { x: 240.25, y: 103 };
			expect(
				stepEndpoints(stepPath(source, target, orientation), orientation),
			).toEqual({ source, target });
		});
	}

	it("reads exponent notation", () => {
		expect(stepEndpoints("M1e-7,0 V50 H120 V100", "TB")).toEqual({
			source: { x: 1e-7, y: 0 },
			target: { x: 120, y: 100 },
		});
	});

	it("returns null for a path it did not produce", () => {
		expect(stepEndpoints("M0,0 L10,10", "TB")).toBeNull();
		expect(stepEndpoints(null, "TB")).toBeNull();
	});
});
