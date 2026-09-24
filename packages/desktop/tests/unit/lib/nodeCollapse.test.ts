// @vitest-environment jsdom
// v0.8.4 Phase 4 — nodeCollapse.ts is store-backed: `hasChildren` comes from
// the roadmap's nodeIndex, `collapsed` from fileViewStore.collapsedIds, and
// nothing reads or clicks the DOM chevron any more.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	expandAncestors,
	getNodeCollapseState,
	toggleNodeCollapse,
} from "../../../src/mainview/lib/nodeCollapse";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Collapse",
	nodes: [
		{
			id: "root",
			title: "Root",
			status: "not-started",
			children: [
				{
					id: "a",
					title: "A",
					status: "not-started",
					children: [{ id: "a1", title: "A1", status: "not-started" }],
				},
				{ id: "b", title: "B", status: "not-started" },
			],
		},
	],
};

// Resolve after enough animation frames for onDone to have run.
function nextFrames(n: number): Promise<void> {
	return new Promise((resolve) => {
		let remaining = n;
		const tick = () => {
			remaining -= 1;
			if (remaining <= 0) resolve();
			else requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
}

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/collapse.json");
});

afterEach(() => {
	useFileViewStore.getState().expandAll();
	resetStore();
	vi.restoreAllMocks();
});

describe("getNodeCollapseState", () => {
	it("reads hasChildren from the index and collapsed from the store", () => {
		expect(getNodeCollapseState("a")).toEqual({
			hasChildren: true,
			collapsed: false,
		});
		useFileViewStore.getState().setCollapsed("a", true);
		expect(getNodeCollapseState("a")).toEqual({
			hasChildren: true,
			collapsed: true,
		});
	});

	it("reports a leaf (or an unknown id) as having no children", () => {
		useFileViewStore.getState().setCollapsed("b", true);
		expect(getNodeCollapseState("b")).toEqual({
			hasChildren: false,
			collapsed: false,
		});
		expect(getNodeCollapseState("nope").hasChildren).toBe(false);
	});
});

describe("toggleNodeCollapse", () => {
	it("writes the store both ways and returns true", () => {
		expect(toggleNodeCollapse("a")).toBe(true);
		expect(useFileViewStore.getState().collapsedIds.has("a")).toBe(true);
		expect(toggleNodeCollapse("a")).toBe(true);
		expect(useFileViewStore.getState().collapsedIds.has("a")).toBe(false);
	});

	it("is a no-op returning false on a leaf", () => {
		const before = useFileViewStore.getState().collapseVersion;
		expect(toggleNodeCollapse("b")).toBe(false);
		expect(useFileViewStore.getState().collapseVersion).toBe(before);
	});
});

describe("expandAncestors", () => {
	it("expands every collapsed ancestor in one store write and calls onDone once", async () => {
		useFileViewStore.getState().collapseAll(["root", "a", "b"]);
		const writes = vi.fn();
		const unsub = useFileViewStore.subscribe(writes);
		const onDone = vi.fn();

		expandAncestors(["root", "a"], onDone);

		expect(writes).toHaveBeenCalledTimes(1);
		expect([...useFileViewStore.getState().collapsedIds]).toEqual(["b"]);
		expect(onDone).not.toHaveBeenCalled();
		await nextFrames(3);
		expect(onDone).toHaveBeenCalledTimes(1);
		unsub();
	});

	it("writes nothing but still calls onDone when nothing is collapsed", async () => {
		const writes = vi.fn();
		const unsub = useFileViewStore.subscribe(writes);
		const onDone = vi.fn();

		expandAncestors(["root", "a"], onDone);
		await nextFrames(3);

		expect(writes).not.toHaveBeenCalled();
		expect(onDone).toHaveBeenCalledTimes(1);
		unsub();
	});

	it("does not call onDone after the returned canceller runs", async () => {
		const onDone = vi.fn();
		const cancel = expandAncestors(["root", "a"], onDone);
		cancel();
		await nextFrames(3);
		expect(onDone).not.toHaveBeenCalled();
	});
});
