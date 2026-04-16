import { afterEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	buildNodeIndex,
	toTreeDatum,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// Test fixture: a schema with 2 levels of nesting (4 nodes total)
const TEST_SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Test Roadmap",
	nodes: [
		{
			id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			title: "Root Node",
			status: "in-progress",
			type: "milestone",
			children: [
				{
					id: "11111111-2222-4333-8444-555555555555",
					title: "Child A",
					status: "completed",
					type: "task",
				},
				{
					id: "22222222-3333-4444-8555-666666666666",
					title: "Child B",
					status: "not-started",
					type: "task",
					children: [
						{
							id: "33333333-4444-4555-8666-777777777777",
							title: "Grandchild B1",
							status: "blocked",
							type: "feature",
						},
					],
				},
			],
		},
	],
};

const TEST_FILE_PATH = "/path/to/roadmap.json";

// Reset store between tests
afterEach(() => {
	resetStore();
});

describe("Initial state", () => {
	it("has correct default values", () => {
		const state = useRoadmapStore.getState();
		expect(state.schema).toBeNull();
		expect(state.filePath).toBeNull();
		expect(state.treeData).toBeNull();
		expect(state.dataKey).toBe("0");
		expect(state.layoutOrientation).toBe("TB");
		expect(state.selectedNodeId).toBeNull();
		expect(state.nodeIndex.size).toBe(0);
	});
});

describe("toTreeDatum", () => {
	it("converts RoadmapNode to RawNodeDatum with name=title", () => {
		const node = TEST_SCHEMA.nodes[0];
		const datum = toTreeDatum(node);
		expect(datum.name).toBe("Root Node");
		expect(datum.attributes?.id).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
		expect(datum.attributes?.status).toBe("in-progress");
		expect(datum.attributes?.type).toBe("milestone");
	});

	it("handles nested children recursively", () => {
		const node = TEST_SCHEMA.nodes[0];
		const datum = toTreeDatum(node);
		expect(datum.children).toHaveLength(2);
		expect(datum.children?.[0].name).toBe("Child A");
		expect(datum.children?.[1].name).toBe("Child B");
		expect(datum.children?.[1].children).toHaveLength(1);
		expect(datum.children?.[1].children?.[0].name).toBe("Grandchild B1");
	});
});

describe("buildNodeIndex", () => {
	it("flattens all nodes into a Map keyed by id", () => {
		const index = buildNodeIndex(TEST_SCHEMA.nodes);
		expect(index.size).toBe(4);
		expect(index.get("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")?.title).toBe(
			"Root Node",
		);
		expect(index.get("11111111-2222-4333-8444-555555555555")?.title).toBe(
			"Child A",
		);
		expect(index.get("22222222-3333-4444-8555-666666666666")?.title).toBe(
			"Child B",
		);
		expect(index.get("33333333-4444-4555-8666-777777777777")?.title).toBe(
			"Grandchild B1",
		);
	});
});

describe("loadSchema", () => {
	it("sets schema, filePath, treeData, and increments dataKey", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const state = useRoadmapStore.getState();

		expect(state.schema).toBe(TEST_SCHEMA);
		expect(state.filePath).toBe(TEST_FILE_PATH);
		expect(state.treeData).not.toBeNull();
		expect(state.treeData?.name).toBe("Root Node");
		expect(Number(state.dataKey)).toBeGreaterThan(Number(before));
	});

	it("populates nodeIndex as flat Map for all nodes at all depths", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const { nodeIndex } = useRoadmapStore.getState();
		expect(nodeIndex.size).toBe(4);
		expect(nodeIndex.has("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
		expect(nodeIndex.has("33333333-4444-4555-8666-777777777777")).toBe(true);
	});
});

describe("updateNodeStatus", () => {
	it("changes nodeIndex entry status WITHOUT changing dataKey", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const dataKeyBefore = useRoadmapStore.getState().dataKey;

		useRoadmapStore
			.getState()
			.updateNodeStatus("11111111-2222-4333-8444-555555555555", "in-progress");

		const state = useRoadmapStore.getState();
		expect(state.dataKey).toBe(dataKeyBefore);
		expect(
			state.nodeIndex.get("11111111-2222-4333-8444-555555555555")?.status,
		).toBe("in-progress");
	});

	it("with invalid nodeId is a no-op (does not throw)", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const dataKeyBefore = useRoadmapStore.getState().dataKey;

		expect(() => {
			useRoadmapStore
				.getState()
				.updateNodeStatus("nonexistent-id", "completed");
		}).not.toThrow();

		expect(useRoadmapStore.getState().dataKey).toBe(dataKeyBefore);
	});
});

describe("setSelectedNode", () => {
	it("updates selectedNodeId", () => {
		useRoadmapStore
			.getState()
			.setSelectedNode("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
		expect(useRoadmapStore.getState().selectedNodeId).toBe(
			"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
		);
	});

	it("can set to null", () => {
		useRoadmapStore
			.getState()
			.setSelectedNode("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
		useRoadmapStore.getState().setSelectedNode(null);
		expect(useRoadmapStore.getState().selectedNodeId).toBeNull();
	});
});

describe("setLayout", () => {
	it("updates layoutOrientation", () => {
		useRoadmapStore.getState().setLayout("LR");
		expect(useRoadmapStore.getState().layoutOrientation).toBe("LR");
	});
});

describe("getSelectedNode", () => {
	it("returns the node from nodeIndex when selectedNodeId is set", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		useRoadmapStore
			.getState()
			.setSelectedNode("11111111-2222-4333-8444-555555555555");
		const node = useRoadmapStore.getState().getSelectedNode();
		expect(node?.title).toBe("Child A");
	});

	it("returns undefined when no node is selected", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const node = useRoadmapStore.getState().getSelectedNode();
		expect(node).toBeUndefined();
	});
});

describe("getNodeCount", () => {
	it("returns total node count from nodeIndex", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		expect(useRoadmapStore.getState().getNodeCount()).toBe(4);
	});

	it("returns 0 when no schema loaded", () => {
		expect(useRoadmapStore.getState().getNodeCount()).toBe(0);
	});
});

describe("reloadSchema", () => {
	it("preserves filePath when reloading", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const modifiedSchema: RoadmapSchema = {
			...TEST_SCHEMA,
			title: "Modified Roadmap",
		};
		useRoadmapStore.getState().reloadSchema(modifiedSchema);
		const state = useRoadmapStore.getState();
		expect(state.filePath).toBe(TEST_FILE_PATH);
		expect(state.schema?.title).toBe("Modified Roadmap");
	});

	it("increments dataKey on reload", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, TEST_FILE_PATH);
		const keyAfterLoad = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().reloadSchema(TEST_SCHEMA);
		expect(Number(useRoadmapStore.getState().dataKey)).toBeGreaterThan(
			Number(keyAfterLoad),
		);
	});
});

describe("resetView", () => {
	it("resets translate and zoomLevel to defaults", () => {
		// Move viewport away from defaults
		useRoadmapStore.getState().setTranslate({ x: 999, y: 999 });
		useRoadmapStore.getState().setZoomLevel(2.5);

		// Reset
		useRoadmapStore.getState().resetView();

		const state = useRoadmapStore.getState();
		expect(state.zoomLevel).toBe(0.8);
		// translate.y should be roughly canvasHeight/3 (calculation depends on window size)
		expect(state.translate.y).toBeGreaterThan(0);
		expect(state.translate.x).toBeGreaterThan(0);
	});

	it("does not contain viewResetKey in state", () => {
		const state = useRoadmapStore.getState();
		expect(state).not.toHaveProperty("viewResetKey");
	});
});
