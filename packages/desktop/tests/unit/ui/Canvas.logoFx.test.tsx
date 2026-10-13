// @vitest-environment jsdom
// v0.9.1 Phase 1 — the canvas watermark is a stage that plays logo effects on
// LOGO_FX_EVENT, without ever re-rendering the canvas or a node card.
import { act, render } from "@testing-library/react";
import type { FunctionComponent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetStore } from "../../helpers/resetStore";

/**
 * Per-card render counter (the Outline.renderCount pattern): `memo` is
 * wrapped so every memoised component with a `nodeId` prop — the
 * RoadmapNodeCard — is counted each time React actually renders it.
 */
const renders = vi.hoisted(() => new Map<string, number>());
const treeRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	type Props = { nodeId?: string };
	const memo = ((
		component: FunctionComponent<Props>,
		compare?: (prev: Readonly<Props>, next: Readonly<Props>) => boolean,
	) =>
		actual.memo((props: Props) => {
			const id = props.nodeId;
			if (id) renders.set(id, (renders.get(id) ?? 0) + 1);
			return component(props);
		}, compare)) as typeof actual.memo;
	return { ...actual, memo };
});

const NODES = vi.hoisted(() => [
	{ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", name: "Root" },
	{ id: "11111111-2222-4333-8444-555555555555", name: "Child" },
]);

/** react-d3-tree stand-in: renders every card once per Canvas render. */
vi.mock("react-d3-tree", async () => {
	const React = await import("react");
	const FakeTree = (props: {
		renderCustomNodeElement?: (p: unknown) => React.ReactNode;
	}): React.ReactElement => {
		treeRenders.count++;
		return React.createElement(
			"svg",
			null,
			NODES.map((n, i) =>
				React.createElement(
					"g",
					{ key: n.id },
					props.renderCustomNodeElement?.({
						nodeDatum: {
							name: n.name,
							attributes: { id: n.id, status: "not-started" },
							children: [],
							__rd3t: { collapsed: false, depth: i },
						},
						toggleNode: vi.fn(),
						hierarchyPointNode: { x: i * 100, y: 0 },
					}),
				),
			),
		);
	};
	return { default: FakeTree };
});

import { Canvas } from "../../../src/mainview/components/Canvas";
import {
	LOGO_FX_EVENT,
	LOGO_FX_IDLE_MAX_MS,
	LOGO_FX_SOURCE,
	LOGO_FX_VARIANT,
	type LogoFxSource,
	type LogoFxVariant,
} from "../../../src/mainview/lib/logoFx/constants";
import { LOGO_FX_EFFECTS } from "../../../src/mainview/lib/logoFx/effects";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useUiStore } from "../../../src/mainview/store/uiStore";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Logo FX fixture",
	nodes: [
		{
			id: NODES[0].id,
			title: "Root",
			status: "not-started",
			children: [{ id: NODES[1].id, title: "Child", status: "not-started" }],
		},
	],
};

/** Minimal WAAPI so effects really add their layers (jsdom has none). */
function stubAnimate(): void {
	Object.defineProperty(Element.prototype, "animate", {
		configurable: true,
		writable: true,
		value: () => {
			let reject = (_: unknown): void => undefined;
			const finished = new Promise((_, rej) => {
				reject = rej;
			});
			return {
				finished,
				cancel: () => reject(new DOMException("cancelled", "AbortError")),
			};
		},
	});
}

function renderStage(): { stage: HTMLElement; unmount: () => void } {
	const { container, unmount } = render(<Canvas />);
	const app = container.querySelector<HTMLElement>('[role="application"]');
	const stage = app?.firstElementChild as HTMLElement | null;
	if (!stage) throw new Error("watermark stage did not render");
	return { stage, unmount };
}

function play(variant: LogoFxVariant | string, source?: LogoFxSource): void {
	act(() => {
		window.dispatchEvent(
			new CustomEvent(LOGO_FX_EVENT, { detail: { variant, source } }),
		);
	});
}

beforeEach(() => {
	resetStore();
	act(() => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/test/logo-fx.json");
	});
	stubAnimate();
	renders.clear();
	treeRenders.count = 0;
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	useUiStore.setState({ logoEffectsEnabled: true });
	useEventApiStore.setState({ connectedCount: 0 });
	delete (Element.prototype as { animate?: unknown }).animate;
	delete (document as { hidden?: boolean }).hidden;
	vi.unstubAllGlobals();
	resetStore();
});

describe("Canvas logo stage", () => {
	it("keeps the watermark: aria-hidden, no pointer events, the 0.04 masked div first", () => {
		const { stage } = renderStage();

		expect(stage.getAttribute("aria-hidden")).toBe("true");
		expect(stage.className).toContain("pointer-events-none");
		expect(stage.className).toContain("w-[800px]");
		expect(stage.className).toContain("h-[800px]");
		const base = stage.firstElementChild as HTMLElement;
		expect(base.className).toContain("opacity-[0.04]");
		expect(base.style.maskImage).toContain("url(");
		expect(stage.childElementCount).toBe(1);
	});

	it("plays a variant on LOGO_FX_EVENT with 0 node-card and 0 canvas re-renders", () => {
		const { stage } = renderStage();
		expect(renders.size).toBe(NODES.length);
		renders.clear();
		const treeBefore = treeRenders.count;

		play(LOGO_FX_VARIANT.SHIMMER);

		expect(stage.childElementCount).toBe(2);
		expect([...renders.entries()]).toEqual([]);
		expect(treeRenders.count).toBe(treeBefore);
	});

	it("ignores an unknown variant", () => {
		const { stage } = renderStage();

		play("breathe");

		expect(stage.childElementCount).toBe(1);
	});

	it.each([
		"pointerdown",
		"keydown",
	])("cancels an idle-sourced effect on any %s (D-3)", (type) => {
		const { stage } = renderStage();
		// Any variant can carry the idle source; Bit drift itself draws on a
		// 2D canvas, which jsdom lacks.
		play(LOGO_FX_VARIANT.SHIMMER, LOGO_FX_SOURCE.IDLE);
		expect(stage.childElementCount).toBe(2);

		act(() => {
			document.body.dispatchEvent(new Event(type, { bubbles: true }));
		});

		expect(stage.childElementCount).toBe(1);
	});

	it.each([
		"pointerdown",
		"keydown",
	])("lets an action-sourced effect play through a %s (D-3)", (type) => {
		const { stage } = renderStage();
		play(LOGO_FX_VARIANT.STATUS_AURORA, LOGO_FX_SOURCE.ACTION);

		act(() => {
			document.body.dispatchEvent(new Event(type, { bubbles: true }));
		});

		expect(stage.childElementCount).toBe(2);
	});

	it("cancels the effect when the window is hidden", () => {
		const { stage } = renderStage();
		play(LOGO_FX_VARIANT.POWER_SURGE);

		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => true,
		});
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});

		expect(stage.childElementCount).toBe(1);
	});

	it("cancels the effect on unmount and stops listening", () => {
		const { stage, unmount } = renderStage();
		play(LOGO_FX_VARIANT.GLITCH);
		expect(stage.childElementCount).toBe(3);

		unmount();
		expect(stage.childElementCount).toBe(1);

		play(LOGO_FX_VARIANT.GLITCH);
		expect(stage.childElementCount).toBe(1);
	});

	it("is silent with the Preferences setting off, and plays again once it is back on", () => {
		const { stage } = renderStage();
		act(() => useUiStore.getState().setLogoEffectsEnabled(false));

		play(LOGO_FX_VARIANT.GLITCH);
		expect(stage.childElementCount).toBe(1);

		act(() => useUiStore.getState().setLogoEffectsEnabled(true));
		play(LOGO_FX_VARIANT.SHIMMER);
		expect(stage.childElementCount).toBe(2);
	});

	it("stops a playing effect when the setting is switched off", () => {
		const { stage } = renderStage();
		play(LOGO_FX_VARIANT.SHIMMER);

		act(() => useUiStore.getState().setLogoEffectsEnabled(false));

		expect(stage.childElementCount).toBe(1);
	});

	it("plays a store-triggered effect with 0 node-card and 0 canvas re-renders", () => {
		const { stage } = renderStage();
		renders.clear();
		const treeBefore = treeRenders.count;

		act(() => useEventApiStore.getState().setState({ connectedCount: 1 }));

		expect(stage.childElementCount).toBe(2);
		expect([...renders.entries()]).toEqual([]);
		expect(treeRenders.count).toBe(treeBefore);
	});

	it("adds no renders to a status change beyond what the change itself causes", () => {
		const blockRenders = (enabled: boolean) => {
			const { stage, unmount } = renderStage();
			act(() => useUiStore.getState().setLogoEffectsEnabled(enabled));
			renders.clear();
			const treeBefore = treeRenders.count;
			act(() =>
				useRoadmapStore.getState().updateNodeStatus(NODES[1].id, "blocked"),
			);
			const result = {
				cards: [...renders.entries()],
				tree: treeRenders.count - treeBefore,
				layers: stage.childElementCount,
			};
			unmount();
			useRoadmapStore.getState().updateNodeStatus(NODES[1].id, "not-started");
			return result;
		};

		const off = blockRenders(false);
		const on = blockRenders(true);

		expect(off.layers).toBe(1);
		expect(on.layers).toBe(3);
		expect(on.cards).toEqual(off.cards);
		expect(on.tree).toBe(off.tree);
	});

	it("plays Bit drift from the idle timer only while the setting is on", () => {
		vi.useFakeTimers();
		const drift = vi
			.spyOn(LOGO_FX_EFFECTS, LOGO_FX_VARIANT.BIT_DRIFT)
			.mockReturnValue({ finished: Promise.resolve(), cancel: vi.fn() });
		act(() => useUiStore.getState().setLogoEffectsEnabled(false));
		renderStage();

		act(() => vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS * 3));
		expect(drift).not.toHaveBeenCalled();

		act(() => useUiStore.getState().setLogoEffectsEnabled(true));
		act(() => vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS));
		expect(drift).toHaveBeenCalled();
	});

	it("never schedules the idle Bit drift under reduced motion", () => {
		vi.useFakeTimers();
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
		const drift = vi.spyOn(LOGO_FX_EFFECTS, LOGO_FX_VARIANT.BIT_DRIFT);
		renderStage();

		act(() => vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS * 3));

		expect(drift).not.toHaveBeenCalled();
	});

	it("leaves the static watermark alone under reduced motion", () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("prefers-reduced-motion"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
		const { stage } = renderStage();
		const before = stage.innerHTML;

		play(LOGO_FX_VARIANT.GLITCH);

		expect(stage.childElementCount).toBe(1);
		expect(stage.innerHTML).toBe(before);
	});
});
