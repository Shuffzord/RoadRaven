import { useEffect, useRef } from "react";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import { useEventLogStore } from "../store/eventLogStore";
import { findParentAndIndex, useRoadmapStore } from "../store/roadmapStore";
import { dispatchOpenRename, type useInlineRename } from "./useInlineRename";

interface RouterDeps {
	inlineRename: ReturnType<typeof useInlineRename>;
	// Canvas passes the latest transform and a positions map (nodeId -> local x/y)
	// so F2 / double-click can open rename with the correct screen position.
	getTransform: () => { x: number; y: number; k: number };
	getContainerRect: () => { left: number; top: number };
	getNodePosition: (nodeId: string) => { x: number; y: number } | null;
	// True iff the node currently has a card rendered on screen. Collapsed
	// subtrees aren't rendered by react-d3-tree, so their nodes return false —
	// arrow-nav uses this to skip into-hidden moves.
	isNodeVisible: (nodeId: string) => boolean;
	togglePanelFocus: () => void;
}

function isInTextInput(active: Element | null): boolean {
	if (!active) return false;
	const el = active as HTMLElement;
	return !!(
		el.tagName === "INPUT" ||
		el.tagName === "TEXTAREA" ||
		el.isContentEditable ||
		el.closest?.(".cm-editor")
	);
}

function isModalOpen(): boolean {
	// Radix renders dialogs with role="dialog" + data-state="open" to a Portal
	// outside the canvas. When a modal is open, the canvas router must stand
	// down so Enter/Space/Escape reach the dialog's own handlers (delete
	// confirmation, etc.) instead of firing mutation shortcuts.
	// Verified against @radix-ui/react-dialog ^1.1 — if Radix changes these
	// attributes in a future major, this guard silently stops working.
	return !!document.querySelector('[role="dialog"][data-state="open"]');
}

function isMenuOpen(): boolean {
	// Radix ContextMenu mounts Content (role="menu") via portal only while open.
	// Pitfall 7: if the router processed Enter while the menu was open, both the
	// menu's onSelect AND the router's addChild would fire on the focused node.
	// Verified against @radix-ui/react-context-menu ^2.2 — update this selector
	// if upgrading past a Radix major that changes role or data-state usage.
	return !!document.querySelector('[role="menu"]');
}

function navigateSibling(
	nodeId: string,
	delta: number,
	isVisible: (id: string) => boolean,
): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const found = findParentAndIndex(schema.nodes, nodeId);
	if (!found) return;
	// Walk in delta direction, skipping siblings whose card isn't rendered
	// (e.g. inside a collapsed subtree). Stops at the first visible neighbour.
	let i = found.index + delta;
	while (i >= 0 && i < found.parentArray.length) {
		const candidate = found.parentArray[i];
		if (isVisible(candidate.id)) {
			useRoadmapStore.getState().setFocusedNode(candidate.id);
			return;
		}
		i += delta;
	}
}

function enterChild(nodeId: string, isVisible: (id: string) => boolean): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const found = findParentAndIndex(schema.nodes, nodeId);
	if (!found) return;
	const target: RoadmapNode = found.parentArray[found.index];
	// First child whose card is actually rendered. If the parent is collapsed,
	// no child is visible and we no-op rather than focus a hidden node.
	const first = target.children?.find((c) => isVisible(c.id));
	if (first) useRoadmapStore.getState().setFocusedNode(first.id);
}

function returnToParent(nodeId: string): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const found = findParentAndIndex(schema.nodes, nodeId);
	if (!found?.parent) return;
	useRoadmapStore.getState().setFocusedNode(found.parent.id);
}

export function useKeyboardRouter(deps: RouterDeps): void {
	// Mirror the latest deps in a ref so the document listener never needs to
	// be detached/re-attached when volatile state (inlineRename.state, etc.)
	// changes. The ref is updated on every render; the handler always reads fresh
	// values through it, so stale-closure bugs are not possible.
	const depsRef = useRef(deps);
	depsRef.current = deps;

	// Main shortcut handler
	useEffect(() => {
		const handler = (e: KeyboardEvent): void => {
			const deps = depsRef.current;
			// Modal dialogs own their own keyboard handling. If one is open,
			// the router must not intercept — otherwise Enter confirms delete
			// but also addChild fires underneath, Space selects behind the
			// overlay, etc.
			if (isModalOpen()) return;
			if (isMenuOpen()) return;
			const active = document.activeElement;
			const inTextInput = isInTextInput(active);
			const store = useRoadmapStore.getState();
			const focusedId = store.focusedNodeId;
			// Action shortcuts (F2/Delete/Enter/Tab/Ctrl+D/Ctrl+↑↓/Ctrl+C/V) fall
			// back to selectedNodeId when no explicit keyboard focus exists. This
			// covers click-then-shortcut: clicking sets both focused+selected, but
			// loadSchema clears focusedNodeId only — and any path that loses focus
			// (chevron click, Portal mount, etc.) leaves the user with a selected
			// node that shortcuts could no longer act on without this fallback.
			// Arrow nav and Space stay focused-only — they're navigation primitives
			// that require explicit keyboard focus to make sense.
			const targetId = focusedId ?? store.selectedNodeId;

			// Ctrl+Shift+L (or Cmd+Shift+L on mac) — toggle event log drawer (D-18)
			if (
				(e.ctrlKey || e.metaKey) &&
				e.shiftKey &&
				e.key.toLowerCase() === "l"
			) {
				if (inTextInput) return; // respect Phase 3 input-focused guard
				e.preventDefault();
				useEventLogStore.getState().toggleOpen();
				return;
			}

			// Context-aware Ctrl+C / Ctrl+V — defers to native when typing in a text input
			if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "v")) {
				if (inTextInput) return;
				if (e.key === "c") {
					if (!targetId) return;
					e.preventDefault();
					void store.copySubtreeToClipboard(targetId);
					return;
				}
				if (e.key === "v") {
					e.preventDefault();
					void store.pasteFromClipboard(targetId);
					return;
				}
			}

			if (inTextInput) return;

			// F6 — global toggle between canvas and side panel focus
			if (e.key === "F6") {
				e.preventDefault();
				deps.togglePanelFocus();
				return;
			}

			// Ctrl+D — duplicate target; auto-rename the copy so the user can
			// retitle it without a second keystroke.
			if ((e.ctrlKey || e.metaKey) && e.key === "d") {
				if (targetId) {
					e.preventDefault();
					dispatchOpenRename(store.duplicateNode(targetId));
				}
				return;
			}

			// Ctrl+Up / Ctrl+Down — reorder siblings
			if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
				if (targetId) {
					e.preventDefault();
					store.moveNodeUp(targetId);
				}
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
				if (targetId) {
					e.preventDefault();
					store.moveNodeDown(targetId);
				}
				return;
			}

			// F2 — inline rename on target node
			if (e.key === "F2" && targetId) {
				e.preventDefault();
				const pos = deps.getNodePosition(targetId);
				if (pos) {
					deps.inlineRename.open(
						targetId,
						pos.x,
						pos.y,
						deps.getTransform(),
						deps.getContainerRect(),
					);
				}
				return;
			}

			// Enter / Shift+Enter / Tab — creation shortcuts. Each dispatches
			// the rename bridge so the new node gets an inline rename input
			// focused immediately (create-then-rename UX).
			if (e.key === "Enter" && !e.shiftKey && targetId) {
				e.preventDefault();
				dispatchOpenRename(store.addChild(targetId));
				return;
			}
			if (e.key === "Enter" && e.shiftKey && targetId) {
				e.preventDefault();
				dispatchOpenRename(store.addSiblingAbove(targetId));
				return;
			}
			if (e.key === "Tab" && !e.shiftKey && targetId) {
				e.preventDefault();
				dispatchOpenRename(store.addSiblingBelow(targetId));
				return;
			}

			// Delete / Backspace — confirmed delete via requestDelete (leaf: immediate; non-leaf: dialog)
			if ((e.key === "Delete" || e.key === "Backspace") && targetId) {
				e.preventDefault();
				store.requestDelete(targetId);
				return;
			}

			// Space — promote focused to selected.
			// stopPropagation so a DOM-focused node button (from an earlier
			// click) doesn't also receive the keypress and fire its onClick,
			// which would snap selection back to the click-focused node rather
			// than the arrow-navigated focusedId.
			if (e.key === " " && focusedId) {
				e.preventDefault();
				e.stopPropagation();
				store.setSelectedNode(focusedId);
				return;
			}

			// Arrow navigation — axis depends on layout orientation.
			// TB: children flow downward, siblings are horizontal neighbors.
			// LR: children flow rightward, siblings are vertical neighbors.
			if (focusedId && e.key.startsWith("Arrow")) {
				const isLR = store.layoutOrientation === "LR";
				const siblingKeys = isLR
					? { prev: "ArrowUp", next: "ArrowDown" }
					: { prev: "ArrowLeft", next: "ArrowRight" };
				const hierarchyKeys = isLR
					? { child: "ArrowRight", parent: "ArrowLeft" }
					: { child: "ArrowDown", parent: "ArrowUp" };
				if (e.key === siblingKeys.prev) {
					e.preventDefault();
					navigateSibling(focusedId, -1, deps.isNodeVisible);
					return;
				}
				if (e.key === siblingKeys.next) {
					e.preventDefault();
					navigateSibling(focusedId, 1, deps.isNodeVisible);
					return;
				}
				if (e.key === hierarchyKeys.child) {
					e.preventDefault();
					enterChild(focusedId, deps.isNodeVisible);
					return;
				}
				if (e.key === hierarchyKeys.parent) {
					e.preventDefault();
					returnToParent(focusedId);
					return;
				}
			}

			// Escape — closes drawer when focus is inside it; otherwise falls through
			// to rename-cancel / deselect-node (Phase 3 contract, UAT 04-06 drive-by fix).
			// Selector matches the EventLogDrawer's <section aria-label="Event log">
			// directly — biome flags an explicit role="region" on <section> as
			// redundant (implicit ARIA semantic role), so we anchor on the
			// element + accessible-name attribute instead. The drawer's region
			// role is preserved by the section element semantic.
			if (e.key === "Escape") {
				const drawer = document.querySelector(
					'section[aria-label="Event log"]',
				);
				const isOpen = useEventLogStore.getState().isOpen;
				if (
					isOpen &&
					drawer &&
					active instanceof Node &&
					drawer.contains(active)
				) {
					e.preventDefault();
					useEventLogStore.getState().setOpen(false);
					return;
				}
				if (deps.inlineRename.state.nodeId) {
					e.preventDefault();
					deps.inlineRename.cancel();
					return;
				}
				store.setSelectedNode(null);
			}
		};

		// Capture phase so the router wins before RoadmapNodeCard's own
		// onKeyDown (which would re-fire onSelect on the DOM-focused card and
		// override arrow-navigation targeting). The wrapper forwards to the
		// handler and then stops propagation for any key the handler claimed
		// (claimed === preventDefault was called), so the card's bubble-phase
		// onKeyDown never sees Space/Enter/etc.
		const capturingHandler = (e: KeyboardEvent): void => {
			handler(e);
			if (e.defaultPrevented) e.stopPropagation();
		};
		document.addEventListener("keydown", capturingHandler, true);
		return () =>
			document.removeEventListener("keydown", capturingHandler, true);
	}, []);

	// Keyboard/mouse mode toggle for focus-ring visibility.
	// onKey MUST use capture phase: the main router above also uses capture +
	// stopPropagation on claimed keys. If this listener ran in bubble phase,
	// the router's stopPropagation would prevent it from ever adding the
	// keyboard-nav-active class, and the dashed focus ring would never appear
	// during arrow navigation.
	useEffect(() => {
		const onKey = (): void => {
			document.body.classList.add("keyboard-nav-active");
		};
		const onMouse = (): void => {
			document.body.classList.remove("keyboard-nav-active");
		};
		document.addEventListener("keydown", onKey, true);
		document.addEventListener("mousedown", onMouse);
		return () => {
			document.removeEventListener("keydown", onKey, true);
			document.removeEventListener("mousedown", onMouse);
		};
	}, []);
}
