/** @vitest-environment jsdom */
// v0.8.2 Phase 3b — Outline perf contract (D-6): a status tick re-renders
// only the row whose status changed, never the list.
import { act, render, screen } from "@testing-library/react";
import type { FunctionComponent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";

/**
 * Per-node render counter. `memo` is wrapped so every memoised component
 * whose props carry a `node` (the OutlineRow) is counted by node id each
 * time React actually renders it — a memo bail-out never reaches here.
 */
const renders = vi.hoisted(() => new Map<string, number>());

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	type Props = { node?: { id: string } };
	const memo = ((
		component: FunctionComponent<Props>,
		compare?: (prev: Readonly<Props>, next: Readonly<Props>) => boolean,
	) =>
		actual.memo((props: Props) => {
			const id = props.node?.id;
			if (id) renders.set(id, (renders.get(id) ?? 0) + 1);
			return component(props);
		}, compare)) as typeof actual.memo;
	return { ...actual, memo };
});

import { Outline } from "../../../src/mainview/components/Outline";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const TOTAL = 300;

/** root -> 13 children -> 22 grandchildren each = 300 nodes. */
function makeSchema(): RoadmapSchema {
	let next = 1;
	const leaf = (): RoadmapNode => {
		const n = next++;
		return { id: `n${n}`, title: `Node ${n}`, status: "not-started" };
	};
	const root: RoadmapNode = { ...leaf(), children: [] };
	while (next <= TOTAL) {
		const branch: RoadmapNode = { ...leaf(), children: [] };
		while (branch.children && branch.children.length < 22 && next <= TOTAL) {
			branch.children.push(leaf());
		}
		root.children?.push(branch);
	}
	return { version: "1.0", title: "perf", nodes: [root] };
}

beforeEach(() => {
	Element.prototype.scrollIntoView = vi.fn() as never;
	useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/perf.json");
	renders.clear();
});

afterEach(() => {
	resetStore();
	renders.clear();
});

describe("Outline render count", () => {
	it("a status tick on one node re-renders only that row", () => {
		render(<Outline collapsed={false} />);
		expect(screen.getAllByRole("treeitem")).toHaveLength(TOTAL);
		expect(renders.size).toBe(TOTAL);
		for (const count of renders.values()) expect(count).toBe(1);

		renders.clear();
		act(() => useRoadmapStore.getState().updateNodeStatus("n42", "completed"));

		expect([...renders.entries()]).toEqual([["n42", 1]]);
		const row = screen.getByRole("treeitem", { name: "Node 42" });
		expect(
			(row.querySelector("span[aria-hidden]") as HTMLElement).style
				.backgroundColor,
		).toBe("var(--rv-status-completed)");
	});
});
