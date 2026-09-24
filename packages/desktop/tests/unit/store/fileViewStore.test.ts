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
