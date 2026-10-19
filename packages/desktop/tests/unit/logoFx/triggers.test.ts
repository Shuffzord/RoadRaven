// v0.9.1 Phase 2 — the action → effect map and the pure store diff that
// decides which app actions one store update performed.
import { describe, expect, it } from "vitest";
import type {
	NodeStatus,
	RoadmapNode,
} from "../../../../../packages/core/src/schema";
import {
	LOGO_FX_ACTION,
	LOGO_FX_BATCH_MIN,
	LOGO_FX_VARIANT,
} from "../../../src/mainview/lib/logoFx/constants";
import {
	detectActions,
	LOGO_FX_TRIGGERS,
	type LogoFxSnapshot,
	snapshotNodes,
} from "../../../src/mainview/lib/logoFx/triggers";

/** phase-a -> [a1, a2]; phase-b -> [b1, b2, b3]. */
function tree(
	statuses: Record<string, NodeStatus> = {},
	updatedAt: Record<string, string> = {},
): RoadmapNode[] {
	const node = (id: string, children?: RoadmapNode[]): RoadmapNode => ({
		id,
		title: id,
		status: statuses[id] ?? "not-started",
		...(updatedAt[id] ? { updatedAt: updatedAt[id] } : {}),
		...(children ? { children } : {}),
	});
	return [
		node("root", [
			node("phase-a", [node("a1"), node("a2")]),
			node("phase-b", [node("b1"), node("b2"), node("b3")]),
		]),
	];
}

function snap(
	nodes: RoadmapNode[] = tree(),
	over: Partial<LogoFxSnapshot> = {},
): LogoFxSnapshot {
	return {
		nodes: snapshotNodes(nodes),
		baseline: 0,
		opened: 0,
		saveState: "saved",
		connectedCount: 0,
		...over,
	};
}

describe("LOGO_FX_TRIGGERS (D-1 map)", () => {
	it("maps every action to the owner-approved variant", () => {
		expect(LOGO_FX_TRIGGERS).toEqual({
			[LOGO_FX_ACTION.AGENT_CONNECTED]: LOGO_FX_VARIANT.CIRCUIT_PULSE,
			[LOGO_FX_ACTION.NODE_COMPLETED]: LOGO_FX_VARIANT.SHIMMER,
			[LOGO_FX_ACTION.PHASE_COMPLETED]: LOGO_FX_VARIANT.STATUS_AURORA,
			[LOGO_FX_ACTION.FILE_OPENED]: LOGO_FX_VARIANT.POWER_SURGE,
			[LOGO_FX_ACTION.AGENT_BATCH]: LOGO_FX_VARIANT.POWER_SURGE,
			[LOGO_FX_ACTION.NODE_BLOCKED]: LOGO_FX_VARIANT.GLITCH,
			[LOGO_FX_ACTION.SAVE_FAILED]: LOGO_FX_VARIANT.GLITCH,
			[LOGO_FX_ACTION.IDLE]: LOGO_FX_VARIANT.BIT_DRIFT,
		});
	});
});

describe("detectActions — one test per map row", () => {
	it("agent-connected: the connected producer count rises", () => {
		const prev = snap(tree(), { connectedCount: 1 });

		expect(detectActions(prev, { ...prev, connectedCount: 2 })).toEqual([
			LOGO_FX_ACTION.AGENT_CONNECTED,
		]);
		expect(detectActions(prev, { ...prev, connectedCount: 0 })).toEqual([]);
	});

	it("node-completed: a node's status changes to completed", () => {
		const prev = snap();

		expect(detectActions(prev, snap(tree({ a1: "completed" })))).toEqual([
			LOGO_FX_ACTION.NODE_COMPLETED,
		]);
	});

	it("phase-completed: the last child of a node completes", () => {
		const prev = snap(tree({ b1: "completed", b2: "completed" }));
		const next = snap(
			tree({ b1: "completed", b2: "completed", b3: "completed" }),
		);

		expect(detectActions(prev, next)).toEqual([LOGO_FX_ACTION.PHASE_COMPLETED]);
	});

	it("file-opened: a loadSchema of a file on disk", () => {
		const prev = snap();

		expect(
			detectActions(prev, snap(tree(), { opened: 1, baseline: 1 })),
		).toEqual([LOGO_FX_ACTION.FILE_OPENED]);
	});

	it("agent-batch: one update changes LOGO_FX_BATCH_MIN nodes", () => {
		const prev = snap();
		const next = snap(tree({}, { a1: "t1", a2: "t1", b1: "t1" }));
		expect(LOGO_FX_BATCH_MIN).toBe(3);

		expect(detectActions(prev, next)).toEqual([LOGO_FX_ACTION.AGENT_BATCH]);
	});

	it("node-blocked: a node's status changes to blocked", () => {
		const prev = snap();

		expect(detectActions(prev, snap(tree({ b2: "blocked" })))).toEqual([
			LOGO_FX_ACTION.NODE_BLOCKED,
		]);
	});

	it("save-failed: saveState enters an error state from a non-error one", () => {
		const prev = snap();
		const failed = { ...prev, saveState: "error-retrying" };

		expect(detectActions(prev, failed)).toEqual([LOGO_FX_ACTION.SAVE_FAILED]);
		expect(
			detectActions(failed, { ...prev, saveState: "error-modal" }),
		).toEqual([]);
		expect(detectActions(prev, { ...prev, saveState: "saving" })).toEqual([]);
	});

	it("idle: never detected from a store update (the idle timer plays it)", () => {
		const prev = snap();

		expect(detectActions(prev, snap(tree({ a1: "in-progress" })))).toEqual([]);
	});
});

describe("detectActions — edges", () => {
	it("phase-completed wins over node-completed for the last child", () => {
		const prev = snap(tree({ a1: "completed" }));
		const next = snap(tree({ a1: "completed", a2: "completed" }));

		const actions = detectActions(prev, next);

		expect(actions).toEqual([LOGO_FX_ACTION.PHASE_COMPLETED]);
		expect(actions).not.toContain(LOGO_FX_ACTION.NODE_COMPLETED);
	});

	it("a load resets the baseline and fires only file-opened", () => {
		const prev = snap();
		const loaded = snap(
			tree({ a1: "completed", a2: "completed", b1: "blocked" }),
			{ baseline: 1, opened: 1 },
		);

		expect(detectActions(prev, loaded)).toEqual([LOGO_FX_ACTION.FILE_OPENED]);
	});

	it("a reload (baseline reset without an open) fires nothing", () => {
		const prev = snap();
		const reloaded = snap(tree({ a1: "completed", b1: "blocked" }), {
			baseline: 1,
		});

		expect(detectActions(prev, reloaded)).toEqual([]);
	});

	it("a below-threshold multi-change fires no agent-batch", () => {
		const prev = snap();
		const next = snap(tree({ a1: "in-progress", b1: "in-progress" }));

		expect(LOGO_FX_BATCH_MIN).toBeGreaterThan(2);
		expect(detectActions(prev, next)).toEqual([]);
	});

	it("a status that does not change fires nothing", () => {
		const prev = snap(tree({ a1: "completed", b2: "blocked" }));
		const next = snap(tree({ a1: "completed", b2: "blocked" }));

		expect(detectActions(prev, next)).toEqual([]);
	});

	it("the same snapshot (no-op store update) fires nothing", () => {
		const prev = snap(tree({ a1: "completed" }));

		expect(detectActions(prev, prev)).toEqual([]);
	});

	it("a newly added completed node is not a completion", () => {
		const prev = snap();
		const grown = tree();
		grown[0].children?.[0].children?.push({
			id: "a3",
			title: "a3",
			status: "completed",
		});

		expect(detectActions(prev, snap(grown))).toEqual([]);
	});

	it("orders one update's actions most specific first", () => {
		const prev = snap(tree({ a1: "completed" }));
		const next = snap(
			tree({
				a1: "completed",
				a2: "completed",
				b1: "blocked",
				b2: "completed",
			}),
			{ saveState: "error-manual", connectedCount: 1 },
		);

		expect(detectActions(prev, next)).toEqual([
			LOGO_FX_ACTION.SAVE_FAILED,
			LOGO_FX_ACTION.NODE_BLOCKED,
			LOGO_FX_ACTION.PHASE_COMPLETED,
			LOGO_FX_ACTION.AGENT_BATCH,
			LOGO_FX_ACTION.AGENT_CONNECTED,
			LOGO_FX_ACTION.NODE_COMPLETED,
		]);
	});
});
