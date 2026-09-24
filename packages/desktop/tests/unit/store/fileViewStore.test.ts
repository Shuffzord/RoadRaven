import { afterEach, describe, expect, it } from "vitest";
import { KNOB_DEFAULTS } from "../../../src/mainview/lib/layoutKnobs";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";

afterEach(() => {
	useFileViewStore.getState().resetKnobs();
});

describe("fileViewStore", () => {
	it("starts at KNOB_DEFAULTS", () => {
		expect(useFileViewStore.getState().layoutKnobs).toEqual(KNOB_DEFAULTS);
	});

	it("setKnob updates one field and leaves the others untouched", () => {
		useFileViewStore.getState().setKnob("siblingGap", 1.8);
		expect(useFileViewStore.getState().layoutKnobs).toEqual({
			...KNOB_DEFAULTS,
			siblingGap: 1.8,
		});
	});

	it("resetKnobs restores every field to defaults", () => {
		useFileViewStore.getState().setKnob("siblingGap", 1.8);
		useFileViewStore.getState().setKnob("density", "compact");
		useFileViewStore.getState().resetKnobs();
		expect(useFileViewStore.getState().layoutKnobs).toEqual(KNOB_DEFAULTS);
	});

	it("hydrate applies a valid saved value", () => {
		useFileViewStore
			.getState()
			.hydrate({ siblingGap: 1.6, depthGap: 1.4, density: "compact" });
		expect(useFileViewStore.getState().layoutKnobs).toEqual({
			siblingGap: 1.6,
			depthGap: 1.4,
			density: "compact",
		});
	});

	it("hydrate with garbage lands on defaults", () => {
		useFileViewStore.getState().setKnob("siblingGap", 1.8);
		useFileViewStore
			.getState()
			.hydrate({ siblingGap: "nonsense", density: 42 });
		expect(useFileViewStore.getState().layoutKnobs).toEqual(KNOB_DEFAULTS);
	});

	it("hydrate with undefined lands on defaults", () => {
		useFileViewStore.getState().setKnob("depthGap", 1.9);
		useFileViewStore.getState().hydrate(undefined);
		expect(useFileViewStore.getState().layoutKnobs).toEqual(KNOB_DEFAULTS);
	});
});

// v0.8.4 Phase 3 — custom layout: the on/off switch and the per-orientation
// node offsets live next to the knobs, owned by the same store.
describe("fileViewStore — custom layout", () => {
	afterEach(() => {
		useFileViewStore.getState().setCustomLayout(false);
		useFileViewStore.getState().resetNodeOffsets("TB");
		useFileViewStore.getState().resetNodeOffsets("LR");
	});

	it("starts with custom layout off and no offsets", () => {
		expect(useFileViewStore.getState().customLayout).toBe(false);
		expect(useFileViewStore.getState().nodeOffsets).toEqual({ TB: {}, LR: {} });
	});

	it("setNodeOffset writes into the named orientation only", () => {
		useFileViewStore.getState().setNodeOffset("TB", "a", { dx: 5, dy: 6 });
		expect(useFileViewStore.getState().nodeOffsets).toEqual({
			TB: { a: { dx: 5, dy: 6 } },
			LR: {},
		});
	});

	it("unchecking custom layout keeps the offsets; re-checking brings them back", () => {
		const s = useFileViewStore.getState();
		s.setCustomLayout(true);
		s.setNodeOffset("TB", "a", { dx: 5, dy: 6 });
		s.setCustomLayout(false);
		expect(useFileViewStore.getState().customLayout).toBe(false);
		expect(useFileViewStore.getState().nodeOffsets.TB.a).toEqual({
			dx: 5,
			dy: 6,
		});
		s.setCustomLayout(true);
		expect(useFileViewStore.getState().nodeOffsets.TB.a).toEqual({
			dx: 5,
			dy: 6,
		});
	});

	it("resetNodeOffsets clears only the given orientation and leaves the switch on", () => {
		const s = useFileViewStore.getState();
		s.setCustomLayout(true);
		s.setNodeOffset("TB", "a", { dx: 5, dy: 6 });
		s.setNodeOffset("LR", "a", { dx: 7, dy: 8 });
		s.resetNodeOffsets("TB");
		expect(useFileViewStore.getState().nodeOffsets).toEqual({
			TB: {},
			LR: { a: { dx: 7, dy: 8 } },
		});
		expect(useFileViewStore.getState().customLayout).toBe(true);
	});

	it("hydrateCustomLayout applies saved values and drops garbage offsets", () => {
		useFileViewStore.getState().hydrateCustomLayout({
			customLayout: true,
			nodeOffsets: { TB: { a: { dx: 1, dy: 2 }, bad: { dx: "x" } } },
		});
		expect(useFileViewStore.getState().customLayout).toBe(true);
		expect(useFileViewStore.getState().nodeOffsets).toEqual({
			TB: { a: { dx: 1, dy: 2 } },
			LR: {},
		});
	});

	it("hydrateCustomLayout leaves a key alone when it was not stored", () => {
		const s = useFileViewStore.getState();
		s.setCustomLayout(true);
		s.setNodeOffset("TB", "a", { dx: 5, dy: 6 });
		s.hydrateCustomLayout({});
		expect(useFileViewStore.getState().customLayout).toBe(true);
		expect(useFileViewStore.getState().nodeOffsets.TB.a).toEqual({
			dx: 5,
			dy: 6,
		});
	});

	it("resetKnobs does not touch custom layout state", () => {
		const s = useFileViewStore.getState();
		s.setCustomLayout(true);
		s.setNodeOffset("TB", "a", { dx: 5, dy: 6 });
		s.resetKnobs();
		expect(useFileViewStore.getState().customLayout).toBe(true);
		expect(useFileViewStore.getState().nodeOffsets.TB.a).toBeDefined();
	});
});
