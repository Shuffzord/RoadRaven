import { useRoadmapStore } from "../store/roadmapStore";
import { FOCUS_NODE_EVENT, requestNodeFocus } from "./focusRequest";
import { findNodeCard, listNodeCards } from "./nodeCard";

/**
 * Real DOM focus handoffs between the app's panes (v0.8.1 Phase 5).
 *
 * The canvas controller deliberately refuses to pull DOM focus out of a
 * control the user chose (`focusCard`'s never-steal guard,
 * hooks/useCanvasFocusController.ts). That is right for every implicit
 * reveal — and wrong for the two moments where moving focus IS what the user
 * asked for:
 *
 *  - **F6**, the WAI-ARIA pane-switch key. Leaving the current control is the
 *    whole request, so `togglePanelFocus` moves DOM focus itself and only
 *    then asks the canvas for a `nearest` reveal.
 *  - **a context menu closing without an action.** The app prevents Radix's
 *    own close-autofocus, which would otherwise restore focus to whatever had
 *    it when the menu Content mounted — for a create item that is the OLD
 *    card, and focusing it would cancel the new node's pending rename.
 *    Escape, a click-away or a plain action therefore left
 *    `document.activeElement` on `<body>` (found in Phase 4). The close hands
 *    focus back itself instead, as an `align: "none"` request: the controller
 *    still owns the guard (so nothing that claimed focus in the meantime is
 *    robbed) and no camera moves, which matters because "Fit to View" is
 *    still animating one frame later.
 *
 * Nothing here reveals a card on its own; the canvas controller does that.
 */

/** The SidePanel's root — App renders exactly one. */
const PANEL_SELECTOR = 'aside[aria-label="Node details"]';

/**
 * Where a pane switch lands inside the panel. SidePanel marks it: the "Edit
 * node" button, or the title input when edit mode is already open.
 *
 * A marker rather than "the first focusable element" for two reasons. The
 * panel's first focusable is the resize grip — a geometry affordance, not the
 * node the user came to read — and the `<aside>` plus its Close button are
 * mounted even while the panel is shut, so "first focusable" answers
 * instantly with the wrong control. The marker exists only once the panel has
 * rendered the node that was just selected, which is exactly the mount F6 has
 * to wait for.
 */
const PANEL_TARGET_SELECTOR = "[data-panel-focus]";

/**
 * Frames F6 gives the panel to render that control before it gives up.
 * Selecting a node is what opens the panel, and its contents only exist after
 * the render that follows — the same bounded rAF poll the focus controller
 * uses to wait for a card.
 */
const MAX_WAIT_FRAMES = 30;

/**
 * Whether the context menu now closing already stated a focus intent.
 *
 * Module state, like the controller's own focus flags: the app mounts exactly
 * one context menu and its open/close pair is a single conversation. A menu
 * item's `onSelect` runs before `onOpenChange(false)`
 * (@radix-ui/react-menu 2.1.17 `MenuItem.handleSelect` dispatches inside
 * `flushSync` and only then calls `onClose`), so by the time the close is
 * reported the request — if there was one — has already been seen.
 */
let menuStatedIntent = false;
let unwatchMenu: (() => void) | null = null;

/** The tree's single tab stop: the focused card, else the root card. */
function tabStopCard(): HTMLElement | null {
	const { focusedNodeId } = useRoadmapStore.getState();
	if (focusedNodeId) return findNodeCard(focusedNodeId);
	return listNodeCards()[0] ?? null;
}

function panelEl(): HTMLElement | null {
	return document.querySelector<HTMLElement>(PANEL_SELECTOR);
}

function focusPanelTarget(framesLeft: number): void {
	const target = panelEl()?.querySelector<HTMLElement>(PANEL_TARGET_SELECTOR);
	if (target) {
		target.focus({ preventScroll: true });
		return;
	}
	if (framesLeft > 0) {
		requestAnimationFrame(() => focusPanelTarget(framesLeft - 1));
	}
}

/** Move DOM focus to the tab-stop card and reveal it (explicit user intent). */
function focusCardAndReveal(): void {
	const card = tabStopCard();
	const nodeId = card?.dataset.sourceId;
	if (!card || !nodeId) return;
	card.focus({ preventScroll: true });
	// After the focus, so the controller's guard sees focus already inside the
	// canvas. The card's own `onFocus` may have asked for the same reveal a
	// moment earlier (keyboard modality); both measure the identical rect in
	// the same tick, so the second request replaces the first and exactly one
	// pan happens.
	requestNodeFocus(nodeId, { align: "nearest" });
}

/**
 * Ask the canvas to take its tab-stop card back, camera untouched.
 *
 * `align: "none"` reaches the controller's `focusCard` — which refuses if
 * anything else holds focus — and then computes a zero pan delta.
 */
export function focusCanvasTabStop(): void {
	const nodeId = tabStopCard()?.dataset.sourceId;
	if (!nodeId) return;
	requestNodeFocus(nodeId, { align: "none" });
}

/**
 * F6: move real DOM focus between the canvas and the SidePanel.
 *
 * Canvas to panel opens the panel first when it is closed (selecting the
 * focused node is what opens it) and then waits for its controls. With
 * nothing focused and nothing selected there is no subject to inspect, so F6
 * does nothing rather than opening an empty panel.
 */
export function togglePanelFocus(): void {
	const panel = panelEl();
	const active = document.activeElement;
	if (panel && active instanceof Node && panel.contains(active)) {
		focusCardAndReveal();
		return;
	}
	const { focusedNodeId, selectedNodeId, setSelectedNode } =
		useRoadmapStore.getState();
	const target = focusedNodeId ?? selectedNodeId;
	if (!target) return;
	if (selectedNodeId !== target) setSelectedNode(target);
	focusPanelTarget(MAX_WAIT_FRAMES);
}

/**
 * Follow one context menu from open to close, and hand focus back when it
 * closed without stating a focus intent of its own.
 *
 * Deferred by one frame because the close is reported while the menu Content
 * is still mounted and its FocusScope still trapping: anything outside the
 * container that takes focus is pulled straight back
 * (@radix-ui/react-focus-scope 1.1.9 `handleFocusIn`).
 */
export function trackMenuFocus(open: boolean): void {
	unwatchMenu?.();
	unwatchMenu = null;
	if (open) {
		menuStatedIntent = false;
		const onRequest = (): void => {
			menuStatedIntent = true;
		};
		window.addEventListener(FOCUS_NODE_EVENT, onRequest);
		unwatchMenu = () => window.removeEventListener(FOCUS_NODE_EVENT, onRequest);
		return;
	}
	if (menuStatedIntent) return;
	requestAnimationFrame(focusCanvasTabStop);
}
