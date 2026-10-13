// @vitest-environment jsdom
// v0.9.1 Phase 2 — real store updates ask for the D-1 variant through
// LOGO_FX_EVENT; the subscriptions never render anything.
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const snapshotSpy = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../../../src/mainview/lib/logoFx/triggers", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../../src/mainview/lib/logoFx/triggers")
		>();
	return {
		...actual,
		snapshotNodes: (...args: Parameters<typeof actual.snapshotNodes>) => {
			snapshotSpy.calls++;
			return actual.snapshotNodes(...args);
		},
	};
});

import { useLogoFxTriggers } from "../../../src/mainview/hooks/useLogoFxTriggers";
import {
	LOGO_FX_EVENT,
	LOGO_FX_SOURCE,
	LOGO_FX_VARIANT,
	type LogoFxRequest,
} from "../../../src/mainview/lib/logoFx/constants";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";
import { useHistoryStore } from "../../../src/mainview/store/historyStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

/** root -> phase (p1 done, p2 open) + task t1 (done) + t2, t3. */
function schema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "triggers",
		nodes: [
			{
				id: "root",
				title: "Root",
				status: "in-progress",
				children: [
					{
						id: "phase",
						title: "Phase",
						status: "in-progress",
						children: [
							{ id: "p1", title: "P1", status: "completed" },
							{ id: "p2", title: "P2", status: "not-started" },
						],
					},
					{ id: "t1", title: "T1", status: "completed" },
					{ id: "t2", title: "T2", status: "not-started" },
					{ id: "t3", title: "T3", status: "not-started" },
				],
			},
		],
	};
}

let requests: LogoFxRequest[] = [];
const record = (e: Event): void => {
	requests.push((e as CustomEvent<LogoFxRequest>).detail);
};
const variants = () => requests.map((r) => r.variant);
const roadmap = () => useRoadmapStore.getState();

function mount() {
	const hook = renderHook(() => useLogoFxTriggers());
	requests = [];
	snapshotSpy.calls = 0;
	return hook;
}

beforeEach(() => {
	resetStore();
	useHistoryStore.getState().clear();
	useEventApiStore.setState({ connectedCount: 0 });
	roadmap().loadSchema(schema(), "/test/triggers.json");
	window.addEventListener(LOGO_FX_EVENT, record);
});

afterEach(() => {
	window.removeEventListener(LOGO_FX_EVENT, record);
	cleanup();
	resetStore();
	useHistoryStore.getState().clear();
	useEventApiStore.setState({ connectedCount: 0 });
});

describe("useLogoFxTriggers — the D-1 map on real stores", () => {
	it("agent-connected: a rising connectedCount asks for Circuit pulse", () => {
		mount();

		act(() => useEventApiStore.getState().setState({ connectedCount: 1 }));
		act(() => useEventApiStore.getState().setState({ connectedCount: 0 }));

		expect(variants()).toEqual([LOGO_FX_VARIANT.CIRCUIT_PULSE]);
	});

	it("node-completed: updateNodeStatus → completed asks for Shimmer", () => {
		mount();

		act(() => roadmap().updateNodeStatus("t2", "completed"));

		expect(requests).toEqual([
			{ variant: LOGO_FX_VARIANT.SHIMMER, source: LOGO_FX_SOURCE.ACTION },
		]);
	});

	it("phase-completed: the last open child completing asks for Status aurora", () => {
		mount();

		act(() => roadmap().updateNodeStatus("p2", "completed"));

		expect(variants()).toEqual([LOGO_FX_VARIANT.STATUS_AURORA]);
	});

	it("file-opened: loadSchema of a file asks for Power surge, once", () => {
		mount();

		act(() => roadmap().loadSchema(schema(), "/test/other.json"));

		expect(variants()).toEqual([LOGO_FX_VARIANT.POWER_SURGE]);
	});

	it("agent-batch: one update changing 3 nodes asks for Power surge", () => {
		mount();

		act(() =>
			roadmap().updateNodesBatch([
				{ nodeId: "t2", notes: "a" },
				{ nodeId: "t3", notes: "b" },
				{ nodeId: "p2", status: "in-progress" },
			]),
		);

		expect(variants()).toEqual([LOGO_FX_VARIANT.POWER_SURGE]);
	});

	it("node-blocked: updateNodeStatus → blocked asks for Glitch", () => {
		mount();

		act(() => roadmap().updateNodeStatus("t3", "blocked"));

		expect(variants()).toEqual([LOGO_FX_VARIANT.GLITCH]);
	});

	it("save-failed: setSaveState into an error state asks for Glitch, once", () => {
		mount();

		act(() => roadmap().setSaveState("error-retrying", "disk full"));
		act(() => roadmap().setSaveState("error-modal", "disk full"));
		act(() => roadmap().setSaveState("saved"));

		expect(variants()).toEqual([LOGO_FX_VARIANT.GLITCH]);
	});
});

describe("useLogoFxTriggers — loads and no-ops", () => {
	it("a load fires no node-completed for the completed nodes it brings", () => {
		mount();
		const done = schema();
		for (const n of done.nodes[0].children ?? []) n.status = "completed";

		act(() => roadmap().loadSchema(done, "/test/done.json"));

		expect(variants()).toEqual([LOGO_FX_VARIANT.POWER_SURGE]);
	});

	it("the sidecar overlay applied right after a load is part of the load", () => {
		mount();

		act(() => {
			roadmap().loadSchema(schema(), "/test/other.json");
			roadmap().applyEventBatch([
				{ nodeId: "t2", status: "blocked", lastEventAt: 1 },
				{ nodeId: "t3", status: "completed", lastEventAt: 1 },
			]);
		});

		expect(variants()).toEqual([LOGO_FX_VARIANT.POWER_SURGE]);
	});

	it("diffs again once the load has settled", async () => {
		mount();
		act(() => roadmap().loadSchema(schema(), "/test/other.json"));
		await Promise.resolve();

		act(() => roadmap().updateNodeStatus("t2", "completed"));

		expect(variants()).toEqual([
			LOGO_FX_VARIANT.POWER_SURGE,
			LOGO_FX_VARIANT.SHIMMER,
		]);
	});

	it("newUntitledSchema and reloadSchema are not file-opened", () => {
		mount();

		act(() => roadmap().newUntitledSchema());
		act(() => roadmap().loadSchema(schema(), "/test/triggers.json"));
		requests = [];
		act(() => {
			const done = schema();
			done.nodes[0].status = "completed";
			roadmap().reloadSchema(done);
		});

		expect(variants()).toEqual([]);
	});

	it("a no-op update (same schema) neither asks nor re-snapshots the tree", () => {
		mount();

		act(() => roadmap().setSelectedNode("t2"));
		act(() => roadmap().bumpLiveTick());
		act(() => roadmap().updateNodeStatus("t1", "completed"));

		expect(variants()).toEqual([]);
		expect(snapshotSpy.calls).toBe(0);
	});

	it("redo that flips a status counts as the action", () => {
		mount();
		act(() => roadmap().updateNodeStatus("t2", "completed"));
		act(() => roadmap().undo());
		requests = [];

		act(() => roadmap().redo());

		expect(variants()).toEqual([LOGO_FX_VARIANT.SHIMMER]);
	});

	it("stops asking after unmount", () => {
		const { unmount } = mount();
		unmount();

		act(() => roadmap().updateNodeStatus("t3", "blocked"));
		act(() => useEventApiStore.getState().setState({ connectedCount: 3 }));

		expect(requests).toEqual([]);
	});

	it("never re-renders the component that subscribes", () => {
		let renders = 0;
		const Host = () => {
			renders++;
			useLogoFxTriggers();
			return null;
		};
		render(createElement(Host));
		requests = [];

		act(() => roadmap().updateNodeStatus("t3", "blocked"));
		act(() => roadmap().loadSchema(schema(), "/test/other.json"));
		act(() => roadmap().setSaveState("error-manual", "x"));
		act(() => useEventApiStore.getState().setState({ connectedCount: 2 }));

		expect(requests.length).toBeGreaterThan(0);
		expect(renders).toBe(1);
	});
});
