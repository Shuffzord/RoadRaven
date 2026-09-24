/** @vitest-environment jsdom */
// v0.8.4 Phase 1 — card visuals: status ribbon, in-progress progress line,
// node-type chip, plugin glyph position. Attribute names come from
// domContract.ts so a rename fails to compile instead of matching nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	NodeStatus,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";
import { STATUS_IDS, STATUS_TOKENS } from "../../../../../shared/themeContract";
import { resetStore } from "../../helpers/resetStore";

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				saveSettings: vi.fn(() => Promise.resolve({ success: true })),
				loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
			},
		},
	},
}));

import { RoadmapNodeCard } from "../../../src/mainview/components/RoadmapNode";
import {
	NODE_CARD_ATTR,
	NODE_PROGRESS_ATTR,
	NODE_RIBBON_ATTR,
	NODE_STATUS_ATTR,
	NODE_TYPE_CHIP_ATTR,
} from "../../../src/mainview/lib/domContract";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

function makeSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "visuals",
		typeConfig: [{ id: "milestone", label: "Milestone" }],
		nodes: [
			{
				id: "root",
				title: "Root",
				status: "in-progress",
				type: "milestone",
				children: [
					{ id: "c1", title: "Done child", status: "completed" },
					{
						id: "c2",
						title: "Open child",
						status: "not-started",
						type: "weird",
					},
					{
						id: "done-parent",
						title: "Done parent",
						status: "completed",
						children: [{ id: "g1", title: "Grandchild", status: "completed" }],
					},
					{ id: "leaf", title: "Quiet leaf", status: "in-progress" },
					{
						id: "live-leaf",
						title: "Live leaf",
						status: "in-progress",
						plugin: { id: "claude-code" },
					},
				],
			},
		],
	};
}

function renderCard(nodeId: string, title: string, status: NodeStatus) {
	const { container } = render(
		<RoadmapNodeCard nodeId={nodeId} title={title} status={status} />,
	);
	const card = container.querySelector(`[${NODE_CARD_ATTR}="${nodeId}"]`);
	if (!card) throw new Error(`card ${nodeId} not rendered`);
	return card as HTMLElement;
}

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/visuals.json");
});

afterEach(() => {
	resetStore();
	vi.restoreAllMocks();
});

describe("RoadmapNodeCard — status ribbon", () => {
	it.each(
		STATUS_IDS,
	)("renders a %s ribbon filled with the card status ink", (s) => {
		const { container } = render(
			<RoadmapNodeCard title={`Card ${s}`} status={s} />,
		);
		const card = container.querySelector(".node") as HTMLElement;
		expect(card.getAttribute(NODE_STATUS_ATTR)).toBe(s);
		const ribbon = card.querySelector(`[${NODE_RIBBON_ATTR}]`);
		expect(ribbon).toBeTruthy();
		const style = ribbon?.getAttribute("style") ?? "";
		expect(style).toContain(`var(${STATUS_TOKENS[s].card}`);
		expect(style).toContain(`var(${STATUS_TOKENS[s].ink})`);
		// Decorative: the badge already says the status in words.
		expect(ribbon?.closest("[aria-hidden='true']")).toBeTruthy();
	});

	it("is clipped by an inner wrapper, never by .node itself", () => {
		const card = renderCard("root", "Root", "in-progress");
		expect(card.className).not.toMatch(/\boverflow-/);
		const clip = card.querySelector(`[${NODE_RIBBON_ATTR}]`)
			?.parentElement as HTMLElement;
		expect(clip).not.toBe(card);
		expect(clip.parentElement).toBe(card);

		// And no stylesheet rule on the bare `.node` (or a `.node[...]` state)
		// declares overflow: the pulse ring (.node::after, inset -3px) and the
		// search outline paint outside the card.
		const css = readFileSync(
			join(__dirname, "../../../src/mainview/index.css"),
			"utf8",
		);
		const nodeRules = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(
			([, selector]) =>
				selector
					.split(",")
					.some((s) => /(^|\s)\.node(\[[^\]]*\])*\s*$/.test(s.trim())),
		);
		expect(nodeRules.length).toBeGreaterThan(0);
		for (const [, , body] of nodeRules) expect(body).not.toMatch(/overflow/);
	});
});

describe("RoadmapNodeCard — progress line", () => {
	it("shows n / m done on an in-progress card with children", () => {
		const card = renderCard("root", "Root", "in-progress");
		const line = card.querySelector(`[${NODE_PROGRESS_ATTR}]`);
		expect(line?.textContent).toBe("2 / 5 done");
	});

	it("follows an in-place child status flip (statusTick, not treeData)", () => {
		const card = renderCard("root", "Root", "in-progress");
		act(() => useRoadmapStore.getState().updateNodeStatus("c2", "completed"));
		expect(card.querySelector(`[${NODE_PROGRESS_ATTR}]`)?.textContent).toBe(
			"3 / 5 done",
		);
	});

	it("is absent on a completed parent", () => {
		const card = renderCard("done-parent", "Done parent", "completed");
		expect(card.querySelector(`[${NODE_PROGRESS_ATTR}]`)).toBeNull();
	});

	it("is absent on an in-progress leaf without a live event", () => {
		const card = renderCard("leaf", "Quiet leaf", "in-progress");
		expect(card.querySelector(`[${NODE_PROGRESS_ATTR}]`)).toBeNull();
	});

	it("shows the last event age on an in-progress leaf inside the live window", () => {
		const now = 1_000_000;
		vi.spyOn(Date, "now").mockReturnValue(now);
		useRoadmapStore.setState({
			liveEventMeta: { "live-leaf": { lastEventAt: now - 12_000 } },
		});
		const card = renderCard("live-leaf", "Live leaf", "in-progress");
		expect(card.querySelector(`[${NODE_PROGRESS_ATTR}]`)?.textContent).toBe(
			"last event 12s ago",
		);
	});
});

describe("RoadmapNodeCard — type chip", () => {
	it("renders the typeConfig label left of the badge", () => {
		const card = renderCard("root", "Root", "in-progress");
		const chip = card.querySelector(`[${NODE_TYPE_CHIP_ATTR}]`);
		if (!chip) throw new Error("no type chip");
		expect(chip.textContent).toBe("Milestone");
		const badge = screen.getByText("In Progress");
		expect(
			chip.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("renders the raw id for a type missing from typeConfig", () => {
		const card = renderCard("c2", "Open child", "not-started");
		expect(card.querySelector(`[${NODE_TYPE_CHIP_ATTR}]`)?.textContent).toBe(
			"weird",
		);
	});

	it("is absent when the node has no type", () => {
		const card = renderCard("c1", "Done child", "completed");
		expect(card.querySelector(`[${NODE_TYPE_CHIP_ATTR}]`)).toBeNull();
	});

	it("follows an in-place type change (updateNodeType bumps statusTick)", () => {
		const card = renderCard("c1", "Done child", "completed");
		act(() => useRoadmapStore.getState().updateNodeType("c1", "milestone"));
		expect(card.querySelector(`[${NODE_TYPE_CHIP_ATTR}]`)?.textContent).toBe(
			"Milestone",
		);
	});
});

describe("RoadmapNodeCard — plugin glyph", () => {
	it("still renders with its aria-label, id and title, now top-left", () => {
		renderCard("live-leaf", "Live leaf", "in-progress");
		const glyph = screen.getByRole("img", { name: "Plugin: Claude Code" });
		expect(glyph.getAttribute("data-plugin-id")).toBe("claude-code");
		expect(glyph.getAttribute("title")).toBe("Connected via Claude Code");
		expect(glyph.className).toMatch(/\bleft-/);
		expect(glyph.className).not.toMatch(/\bright-/);
	});
});
