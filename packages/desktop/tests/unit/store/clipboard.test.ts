import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";
import {
	CLIPBOARD_MAGIC,
	parseSubtree,
	refreshNodeIds,
	serializeSubtree,
} from "../../../src/mainview/store/clipboard";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";

function makeTestSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "Test",
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [
					{
						id: CHILD_A_ID,
						title: "A",
						status: "in-progress",
						notes: "some note",
						metadata: { k: "v" },
						children: [
							{
								id: "b1111111-2222-4333-8444-555555555555",
								title: "A1",
								status: "completed",
							},
						],
					},
				],
			},
		],
	};
}

function loadTestSchema(): void {
	useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/test.json");
}

const clipboardMock: { text: string; denyRead: boolean } = {
	text: "",
	denyRead: false,
};

beforeEach(() => {
	clipboardMock.text = "";
	clipboardMock.denyRead = false;
	vi.stubGlobal("navigator", {
		clipboard: {
			writeText: vi.fn(async (t: string) => {
				clipboardMock.text = t;
			}),
			readText: vi.fn(async () => {
				if (clipboardMock.denyRead) throw new Error("denied");
				return clipboardMock.text;
			}),
		},
	});
});

afterEach(() => {
	resetStore();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("serializeSubtree", () => {
	it("returns a valid JSON envelope containing the full subtree", () => {
		const node: RoadmapNode = {
			id: "id1",
			title: "X",
			status: "not-started",
			children: [{ id: "id2", title: "Y", status: "completed" }],
		};
		const raw = serializeSubtree(node);
		const parsed = JSON.parse(raw);
		expect(parsed.magic).toBe(CLIPBOARD_MAGIC);
		expect(parsed.node.title).toBe("X");
		expect(parsed.node.children[0].title).toBe("Y");
	});
});

describe("parseSubtree", () => {
	it("parses a serialized subtree and round-trips structure", () => {
		const node: RoadmapNode = {
			id: "id1",
			title: "X",
			status: "not-started",
			children: [{ id: "id2", title: "Y", status: "completed" }],
		};
		const raw = serializeSubtree(node);
		const parsed = parseSubtree(raw);
		expect(parsed).not.toBeNull();
		expect(parsed?.title).toBe("X");
		expect(parsed?.children?.[0].title).toBe("Y");
	});

	it("returns null on missing magic or malformed JSON", () => {
		expect(parseSubtree("not json")).toBeNull();
		expect(parseSubtree(JSON.stringify({ foo: "bar" }))).toBeNull();
		expect(
			parseSubtree(
				JSON.stringify({ magic: "wrong:magic", node: { id: "a", title: "x" } }),
			),
		).toBeNull();
	});
});

describe("refreshNodeIds", () => {
	it("assigns fresh UUIDs to every descendant while preserving title/status/notes/metadata", () => {
		const node: RoadmapNode = {
			id: "old-root",
			title: "R",
			status: "not-started",
			notes: "hi",
			metadata: { p: 1 },
			type: "task",
			children: [
				{
					id: "old-child",
					title: "C",
					status: "completed",
					children: [{ id: "old-grand", title: "G", status: "blocked" }],
				},
			],
		};
		const fresh = refreshNodeIds(node);
		expect(fresh.id).not.toBe("old-root");
		expect(fresh.title).toBe("R");
		expect(fresh.notes).toBe("hi");
		expect(fresh.type).toBe("task");
		expect(fresh.metadata?.p).toBe(1);
		expect(fresh.children?.[0].id).not.toBe("old-child");
		expect(fresh.children?.[0].title).toBe("C");
		expect(fresh.children?.[0].status).toBe("completed");
		expect(fresh.children?.[0].children?.[0].id).not.toBe("old-grand");
		expect(fresh.children?.[0].children?.[0].title).toBe("G");
	});
});

describe("copySubtreeToClipboard", () => {
	it("writes to navigator.clipboard.writeText AND stores in lastCopiedSubtree buffer", async () => {
		loadTestSchema();
		await useRoadmapStore.getState().copySubtreeToClipboard(CHILD_A_ID);
		expect(navigator.clipboard.writeText).toHaveBeenCalled();
		const raw = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock
			.calls[0][0];
		const parsed = JSON.parse(raw);
		expect(parsed.magic).toBe(CLIPBOARD_MAGIC);
		expect(parsed.node.title).toBe("A");

		const buffer = useRoadmapStore.getState().lastCopiedSubtree;
		expect(buffer).not.toBeNull();
		expect(buffer?.title).toBe("A");
	});
});

describe("pasteFromClipboard", () => {
	it("pastes from clipboard with fresh UUIDs and inserts under parent", async () => {
		loadTestSchema();
		// Pre-populate clipboard with a serialized subtree
		const subtree: RoadmapNode = {
			id: "src-id",
			title: "Pasted",
			status: "in-progress",
			children: [
				{ id: "src-child", title: "Pasted-child", status: "completed" },
			],
		};
		clipboardMock.text = serializeSubtree(subtree);

		const newId = await useRoadmapStore.getState().pasteFromClipboard(ROOT_ID);
		expect(newId).toBeTruthy();
		const state = useRoadmapStore.getState();
		const pasted = state.nodeIndex.get(newId as string);
		expect(pasted?.title).toBe("Pasted");
		// fresh UUIDs
		expect(pasted?.id).not.toBe("src-id");
		expect(pasted?.children?.[0].id).not.toBe("src-child");
		expect(pasted?.children?.[0].title).toBe("Pasted-child");

		// Inserted as a child of ROOT_ID
		const root = state.nodeIndex.get(ROOT_ID);
		expect(root?.children?.find((c) => c.id === newId)).toBeDefined();
	});

	it("falls back to in-memory lastCopiedSubtree when navigator.clipboard.readText rejects", async () => {
		loadTestSchema();
		// First, copy something to populate the buffer
		await useRoadmapStore.getState().copySubtreeToClipboard(CHILD_A_ID);

		// Simulate clipboard.readText denial
		clipboardMock.denyRead = true;

		const newId = await useRoadmapStore.getState().pasteFromClipboard(ROOT_ID);
		expect(newId).toBeTruthy();
		const state = useRoadmapStore.getState();
		const pasted = state.nodeIndex.get(newId as string);
		expect(pasted?.title).toBe("A"); // from the in-memory copy of CHILD_A
		expect(pasted?.id).not.toBe(CHILD_A_ID); // fresh UUID
	});
});
