/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
	resetStore();
});

afterEach(() => {
	resetStore();
});

describe("newUntitledSchema (EDIT-17)", () => {
	it("1. populates store with version 1.0, title 'Untitled Roadmap', single 'not-started' root node", () => {
		useRoadmapStore.getState().newUntitledSchema();
		const { schema } = useRoadmapStore.getState();
		expect(schema).not.toBeNull();
		expect(schema?.version).toBe("1.0");
		expect(schema?.title).toBe("Untitled Roadmap");
		expect(schema?.nodes).toHaveLength(1);
		expect(schema?.nodes[0].title).toBe("Untitled");
		expect(schema?.nodes[0].status).toBe("not-started");
	});

	it("2. isUntitled is true after newUntitledSchema, false after loadSchema", () => {
		useRoadmapStore.getState().newUntitledSchema();
		expect(useRoadmapStore.getState().isUntitled).toBe(true);

		useRoadmapStore.getState().loadSchema(
			{
				version: "1.0",
				title: "Loaded",
				nodes: [
					{
						id: "11111111-2222-4333-8444-555555555555",
						title: "Loaded Root",
						status: "not-started",
					},
				],
			},
			"/tmp/loaded.json",
		);
		expect(useRoadmapStore.getState().isUntitled).toBe(false);
	});

	it("3. filePath is null after newUntitledSchema", () => {
		useRoadmapStore.getState().newUntitledSchema();
		expect(useRoadmapStore.getState().filePath).toBeNull();
	});

	it("4. schema.statusConfig populated with 4 defaults", () => {
		useRoadmapStore.getState().newUntitledSchema();
		const { schema } = useRoadmapStore.getState();
		const ids = (schema?.statusConfig ?? []).map((s) => s.id);
		expect(ids).toEqual(["not-started", "in-progress", "completed", "blocked"]);
	});

	it("5. root node has a valid UUID v4", () => {
		useRoadmapStore.getState().newUntitledSchema();
		const root = useRoadmapStore.getState().schema?.nodes[0];
		expect(root?.id).toMatch(UUID_V4_REGEX);
	});

	it("6. createdAt and updatedAt are present and equal on the root", () => {
		useRoadmapStore.getState().newUntitledSchema();
		const root = useRoadmapStore.getState().schema?.nodes[0];
		expect(root?.createdAt).toBeTypeOf("string");
		expect(root?.updatedAt).toBeTypeOf("string");
		expect(root?.createdAt).toBe(root?.updatedAt);
	});
});
