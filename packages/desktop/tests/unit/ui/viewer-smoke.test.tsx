import { beforeEach, describe, expect, it } from "vitest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import {
	collectNodeIds,
	generateLargeSchema,
} from "../../bench/generateSchema";
import { resetStore } from "../../helpers/resetStore";

describe("Viewer smoke tests", () => {
	beforeEach(() => {
		resetStore();
	});

	it("generateLargeSchema(300) produces at least 300 nodes", () => {
		const schema = generateLargeSchema(300);
		const nodeIds = collectNodeIds(schema);
		expect(nodeIds.length).toBeGreaterThanOrEqual(300);
	});

	it("loads a 300-node schema without error", () => {
		const schema = generateLargeSchema(300);
		useRoadmapStore.getState().loadSchema(schema, "/test/large.json");

		const state = useRoadmapStore.getState();
		expect(state.schema).not.toBeNull();
		expect(state.treeData).not.toBeNull();
		expect(state.treeData?.name).toBe(schema.nodes[0].title);
		expect(state.nodeIndex.size).toBeGreaterThanOrEqual(300);
		expect(state.dataKey).not.toBe("0");
	});

	it("treeData has react-d3-tree compatible shape", () => {
		const schema = generateLargeSchema(10);
		useRoadmapStore.getState().loadSchema(schema, "/test/small.json");

		const state = useRoadmapStore.getState();
		const treeData = state.treeData;

		// Must have 'name' field (react-d3-tree requirement)
		expect(treeData).toHaveProperty("name");
		// Must have 'attributes' with our custom fields
		expect(treeData?.attributes).toHaveProperty("id");
		expect(treeData?.attributes).toHaveProperty("status");
	});

	it("updateNodeStatus does NOT change dataKey (performance contract)", () => {
		const schema = generateLargeSchema(50);
		useRoadmapStore.getState().loadSchema(schema, "/test/perf.json");

		const dataKeyAfterLoad = useRoadmapStore.getState().dataKey;
		const nodeIds = collectNodeIds(schema);

		// Fire 10 status updates
		for (let i = 0; i < 10; i++) {
			useRoadmapStore.getState().updateNodeStatus(nodeIds[i], "completed");
		}

		const dataKeyAfterUpdates = useRoadmapStore.getState().dataKey;
		expect(dataKeyAfterUpdates).toBe(dataKeyAfterLoad);
	});

	it("reloadSchema increments dataKey", () => {
		const schema = generateLargeSchema(10);
		useRoadmapStore.getState().loadSchema(schema, "/test/reload.json");
		const dataKeyBefore = useRoadmapStore.getState().dataKey;

		useRoadmapStore.getState().reloadSchema(schema);
		const dataKeyAfter = useRoadmapStore.getState().dataKey;

		expect(dataKeyAfter).not.toBe(dataKeyBefore);
	});

	it("setLayout updates layoutOrientation", () => {
		expect(useRoadmapStore.getState().layoutOrientation).toBe("TB");
		useRoadmapStore.getState().setLayout("LR");
		expect(useRoadmapStore.getState().layoutOrientation).toBe("LR");
	});

	it("setSelectedNode + getSelectedNode round-trips", () => {
		const schema = generateLargeSchema(10);
		const nodeIds = collectNodeIds(schema);
		useRoadmapStore.getState().loadSchema(schema, "/test/select.json");

		useRoadmapStore.getState().setSelectedNode(nodeIds[0]);
		const selected = useRoadmapStore.getState().getSelectedNode();
		expect(selected).toBeDefined();
		expect(selected?.id).toBe(nodeIds[0]);
	});
});
