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

// v0.8.4 Phase 4 — collapse state is owned here (RC1): one set, a version
// that bumps on every real change, and nothing else.
describe("fileViewStore — collapse", () => {
	afterEach(() => {
		useFileViewStore.getState().expandAll();
	});

	const collapsed = () => [...useFileViewStore.getState().collapsedIds].sort();
	const version = () => useFileViewStore.getState().collapseVersion;

	it("toggleCollapsed flips one id and bumps collapseVersion each time", () => {
		const v0 = version();
		useFileViewStore.getState().toggleCollapsed("a");
		expect(collapsed()).toEqual(["a"]);
		expect(version()).toBe(v0 + 1);
		useFileViewStore.getState().toggleCollapsed("a");
		expect(collapsed()).toEqual([]);
		expect(version()).toBe(v0 + 2);
	});

	it("a write that changes nothing keeps the same set and version", () => {
		useFileViewStore.getState().setCollapsed("a", true);
		const before = useFileViewStore.getState().collapsedIds;
		const v = version();
		useFileViewStore.getState().setCollapsed("a", true);
		useFileViewStore.getState().expandMany(["zzz"]);
		expect(useFileViewStore.getState().collapsedIds).toBe(before);
		expect(version()).toBe(v);
	});

	it("expandMany removes several ids in one write", () => {
		useFileViewStore.getState().collapseAll(["a", "b", "c"]);
		const v = version();
		useFileViewStore.getState().expandMany(["a", "c"]);
		expect(collapsed()).toEqual(["b"]);
		expect(version()).toBe(v + 1);
	});

	it("collapseAll replaces the set; expandAll empties it", () => {
		useFileViewStore.getState().setCollapsed("x", true);
		useFileViewStore.getState().collapseAll(["a", "b"]);
		expect(collapsed()).toEqual(["a", "b"]);
		useFileViewStore.getState().expandAll();
		expect(collapsed()).toEqual([]);
	});

	it("collapseToDepth collapses the parents at that depth and nothing else", () => {
		const nodes = [
			{
				id: "root",
				title: "R",
				status: "not-started" as const,
				children: [
					{
						id: "a",
						title: "A",
						status: "not-started" as const,
						children: [
							{ id: "a1", title: "A1", status: "not-started" as const },
						],
					},
					{ id: "b", title: "B", status: "not-started" as const },
				],
			},
		];
		useFileViewStore.getState().collapseAll(["root"]);
		useFileViewStore.getState().collapseToDepth(1, nodes);
		expect(collapsed()).toEqual(["a"]);
	});

	it("hydrateCollapsed replaces with a stored array, keeps on undefined, drops non-strings", () => {
		useFileViewStore.getState().setCollapsed("kept", true);
		useFileViewStore.getState().hydrateCollapsed(undefined);
		expect(collapsed()).toEqual(["kept"]);
		useFileViewStore.getState().hydrateCollapsed(["a", 5, "b"]);
		expect(collapsed()).toEqual(["a", "b"]);
	});

	it("resetForNewFile puts knobs, custom layout, offsets and collapse back to defaults", () => {
		const s = useFileViewStore.getState();
		s.setKnob("siblingGap", 1.8);
		s.setCustomLayout(true);
		s.setNodeOffset("TB", "a", { dx: 5, dy: 6 });
		s.setCollapsed("a", true);
		s.resetForNewFile();
		const after = useFileViewStore.getState();
		expect(after.layoutKnobs).toEqual(KNOB_DEFAULTS);
		expect(after.customLayout).toBe(false);
		expect(after.nodeOffsets).toEqual({ TB: {}, LR: {} });
		expect(collapsed()).toEqual([]);
	});
});
