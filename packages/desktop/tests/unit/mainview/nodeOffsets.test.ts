import { describe, expect, it } from "vitest";
import {
	clampOffsets,
	EMPTY_NODE_OFFSETS,
	effectiveOffset,
	screenDeltaToCanvas,
} from "../../../src/mainview/lib/nodeOffsets";

// v0.8.4 Phase 3 — pure view-layer offset math (custom layout).

const OFFSETS = {
	TB: { a: { dx: 10, dy: 20 } },
	LR: { a: { dx: -5, dy: 7 } },
};

describe("effectiveOffset", () => {
	it("is zero when custom layout is off, even with a stored offset", () => {
		expect(
			effectiveOffset({ customLayout: false, nodeOffsets: OFFSETS }, "TB", "a"),
		).toEqual({ dx: 0, dy: 0 });
	});

	it("returns the stored offset for the orientation when custom layout is on", () => {
		const state = { customLayout: true, nodeOffsets: OFFSETS };
		expect(effectiveOffset(state, "TB", "a")).toEqual({ dx: 10, dy: 20 });
		expect(effectiveOffset(state, "LR", "a")).toEqual({ dx: -5, dy: 7 });
	});

	it("keeps the orientation maps independent", () => {
		const state = {
			customLayout: true,
			nodeOffsets: { TB: { a: { dx: 1, dy: 2 } }, LR: {} },
		};
		expect(effectiveOffset(state, "LR", "a")).toEqual({ dx: 0, dy: 0 });
	});

	it("is zero for a node without an offset", () => {
		expect(
			effectiveOffset({ customLayout: true, nodeOffsets: OFFSETS }, "TB", "b"),
		).toEqual({ dx: 0, dy: 0 });
	});
});

describe("clampOffsets", () => {
	it("keeps finite entries in both orientations", () => {
		expect(clampOffsets(OFFSETS)).toEqual(OFFSETS);
	});

	it("drops entries that are not finite numbers", () => {
		expect(
			clampOffsets({
				TB: {
					ok: { dx: 1, dy: 2 },
					nan: { dx: Number.NaN, dy: 0 },
					str: { dx: "3", dy: 4 },
					missing: { dx: 1 },
					inf: { dx: Number.POSITIVE_INFINITY, dy: 1 },
					nul: null,
				},
				LR: "nonsense",
			}),
		).toEqual({ TB: { ok: { dx: 1, dy: 2 } }, LR: {} });
	});

	it("returns empty maps for garbage or undefined input", () => {
		expect(clampOffsets(undefined)).toEqual(EMPTY_NODE_OFFSETS);
		expect(clampOffsets(42)).toEqual({ TB: {}, LR: {} });
		expect(clampOffsets([1, 2])).toEqual({ TB: {}, LR: {} });
	});

	it("drops extra fields on an entry", () => {
		expect(clampOffsets({ TB: { a: { dx: 1, dy: 2, z: 9 } } })).toEqual({
			TB: { a: { dx: 1, dy: 2 } },
			LR: {},
		});
	});
});

describe("screenDeltaToCanvas", () => {
	it("divides the screen delta by the zoom factor", () => {
		expect(screenDeltaToCanvas({ dx: 30, dy: -60 }, 2)).toEqual({
			dx: 15,
			dy: -30,
		});
		expect(screenDeltaToCanvas({ dx: 30, dy: 12 }, 0.5)).toEqual({
			dx: 60,
			dy: 24,
		});
	});

	it("is the identity at zoom 1", () => {
		expect(screenDeltaToCanvas({ dx: 7, dy: 9 }, 1)).toEqual({ dx: 7, dy: 9 });
	});
});
