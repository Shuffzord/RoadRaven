// @vitest-environment jsdom
// Plan 04-06 Task 1 — pulse animation regression guard for UAT-1.
// Sources: D-14, D-15, UI-SPEC §"Pulse animation — exact specification".
//
// Strategy: assert the data-live attribute toggling in JSDOM (behavioral),
// then assert the new `.node::after` CSS rules + reduced-motion fallback
// exist in index.css via fs (static contract). JSDOM cannot run keyframes
// or reliably resolve pseudo-element computed styles for animated
// properties, so the visible-pulse contract is exercised manually in
// Task 3 step (d).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RoadmapNodeCard } from "../../../src/mainview/components/RoadmapNode";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

const NODE_ID = "node-pulse-test";

// Path to index.css relative to the desktop package root (tests run with cwd=packages/desktop)
const INDEX_CSS_PATH = resolve(__dirname, "../../../src/mainview/index.css");
const INDEX_CSS = readFileSync(INDEX_CSS_PATH, "utf8");

beforeEach(() => {
	const node = {
		id: NODE_ID,
		title: "T",
		status: "in-progress" as const,
		createdAt: "",
		updatedAt: "",
	};
	useRoadmapStore.setState({
		nodeIndex: new Map([[NODE_ID, node as never]]),
		statusTick: 0,
		liveTick: 0,
		liveEventMeta: {},
	});
});

afterEach(() => {
	useRoadmapStore.setState({
		nodeIndex: new Map(),
		liveEventMeta: {},
	});
});

describe("RoadmapNode pulse (D-14/D-15, UAT-1 regression — ::after pseudo-element)", () => {
	it("does NOT have data-live when no event has been received", () => {
		const { container } = render(
			<RoadmapNodeCard title="T" status="in-progress" nodeId={NODE_ID} />,
		);
		const node = container.querySelector(".node");
		expect(node).not.toHaveAttribute("data-live");
	});

	it('sets data-live="true" when liveEventMeta has a fresh entry', () => {
		act(() => {
			useRoadmapStore.setState({
				liveEventMeta: {
					[NODE_ID]: { lastEventAt: Date.now(), source: "test" },
				},
			});
		});
		const { container } = render(
			<RoadmapNodeCard title="T" status="in-progress" nodeId={NODE_ID} />,
		);
		const node = container.querySelector(".node");
		expect(node).toHaveAttribute("data-live", "true");
	});

	it("becomes stale (no data-live) when liveEventMeta entry is older than 30s", () => {
		act(() => {
			useRoadmapStore.setState({
				liveEventMeta: {
					[NODE_ID]: { lastEventAt: Date.now() - 31_000, source: "test" },
				},
			});
		});
		const { container } = render(
			<RoadmapNodeCard title="T" status="in-progress" nodeId={NODE_ID} />,
		);
		const node = container.querySelector(".node");
		expect(node).not.toHaveAttribute("data-live");
	});

	it("renders Tailwind `relative` on the card (positioning context for ::after)", () => {
		const { container } = render(
			<RoadmapNodeCard title="T" status="in-progress" nodeId={NODE_ID} />,
		);
		const node = container.querySelector<HTMLElement>(".node");
		expect(node).not.toBeNull();
		// The .node element must carry the `relative` class so the new
		// `.node::after` pseudo-element resolves its `position: absolute`
		// against the card's containing block.
		expect(node?.className).toMatch(/\brelative\b/);
	});

	it("index.css declares the .node::after pulse pseudo-element (CSS contract)", () => {
		// Base rule: `.node::after { ... position: absolute; inset: -3px; ... }`
		expect(INDEX_CSS).toMatch(/\.node::after\s*\{/);
		expect(INDEX_CSS).toMatch(/inset:\s*-3px/);
		// Live-state rule: `.node[data-live="true"]::after { animation: ... }`
		expect(INDEX_CSS).toMatch(
			/\.node\[data-live="true"\]::after\s*\{[^}]*animation:\s*rv-node-pulse/,
		);
		// Keyframe paints border-width 3px at midpoint (peak of pulse)
		expect(INDEX_CSS).toMatch(/border-width:\s*3px/);
	});

	it("index.css declares the reduced-motion ::after static-border fallback (CSS contract)", () => {
		// The reduced-motion media block must target `.node[data-live="true"]::after`
		// and apply a static 2px solid border using --rv-status-completed.
		const reducedMotionBlock = INDEX_CSS.match(
			/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/g,
		);
		expect(reducedMotionBlock).not.toBeNull();
		// At least one prefers-reduced-motion block contains the ::after fallback
		const hasAfterFallback = (reducedMotionBlock ?? []).some(
			(block) =>
				/\.node\[data-live="true"\]::after/.test(block) &&
				/border:\s*2px\s+solid\s+var\(--rv-status-completed\)/.test(block),
		);
		expect(hasAfterFallback).toBe(true);
	});
});
