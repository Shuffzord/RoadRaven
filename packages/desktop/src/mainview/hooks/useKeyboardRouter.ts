import { useEffect } from "react";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import {
	findParentAndIndex,
	useRoadmapStore,
} from "../store/roadmapStore";
import type { useInlineRename } from "./useInlineRename";

interface RouterDeps {
	inlineRename: ReturnType<typeof useInlineRename>;
	// Canvas passes the latest transform and a positions map (nodeId -> local x/y)
	// so F2 / double-click can open rename with the correct screen position.
	getTransform: () => { x: number; y: number; k: number };
	getContainerRect: () => { left: number; top: number };
	getNodePosition: (nodeId: string) => { x: number; y: number } | null;
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
	return !!document.querySelector('[role="dialog"][data-state="open"]');
}

function navigateSibling(nodeId: string, delta: number): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const found = findParentAndIndex(schema.nodes, nodeId);
	if (!found) return;
	const next = found.parentArray[found.index + delta];
	if (next) useRoadmapStore.getState().setFocusedNode(next.id);
}

function enterChild(nodeId: string): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const found = findParentAndIndex(schema.nodes, nodeId);
	if (!found) return;
	const target: RoadmapNode = found.parentArray[found.index];
	const first = target.children?.[0];
	if (first) useRoadmapStore.getState().setFocusedNode(first.id);
}

function returnToParent(nodeId: string): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const found = findParentAndIndex(schema.nodes, nodeId);
	if (!found || !found.parent) return;
	useRoadmapStore.getState().setFocusedNode(found.parent.id);
}

export function useKeyboardRouter(deps: RouterDeps): void {
	// Main shortcut handler
	useEffect(() => {
		const handler = (e: KeyboardEvent): void => {
			// Modal dialogs own their own keyboard handling. If one is open,
			// the router must not intercept — otherwise Enter confirms delete
			// but also addChild fires underneath, Space selects behind the
			// overlay, etc.
			if (isModalOpen()) return;
			const active = document.activeElement;
			const inTextInput = isInTextInput(active);
			const store = useRoadmapStore.getState();
			const focusedId = store.focusedNodeId;

			// Context-aware Ctrl+C / Ctrl+V — defers to native when typing in a text input
			if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "v")) {
				if (inTextInput) return;
				if (e.key === "c") {
					if (!focusedId) return;
					e.preventDefault();
					void store.copySubtreeToClipboard(focusedId);
					return;
				}
				if (e.key === "v") {
					e.preventDefault();
					void store.pasteFromClipboard(focusedId);
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

			// Ctrl+D — duplicate focused
			if ((e.ctrlKey || e.metaKey) && e.key === "d") {
				if (focusedId) {
					e.preventDefault();
					store.duplicateNode(focusedId);
				}
				return;
			}

			// Ctrl+Up / Ctrl+Down — reorder siblings
			if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
				if (focusedId) {
					e.preventDefault();
					store.moveNodeUp(focusedId);
				}
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
				if (focusedId) {
					e.preventDefault();
					store.moveNodeDown(focusedId);
				}
				return;
			}

			// F2 — inline rename on focused node
			if (e.key === "F2" && focusedId) {
				e.preventDefault();
				const pos = deps.getNodePosition(focusedId);
				if (pos) {
					deps.inlineRename.open(
						focusedId,
						pos.x,
						pos.y,
						deps.getTransform(),
						deps.getContainerRect(),
					);
				}
				return;
			}

			// Enter / Shift+Enter / Tab — creation shortcuts
			if (e.key === "Enter" && !e.shiftKey && focusedId) {
				e.preventDefault();
				store.addChild(focusedId);
				return;
			}
			if (e.key === "Enter" && e.shiftKey && focusedId) {
				e.preventDefault();
				store.addSiblingAbove(focusedId);
				return;
			}
			if (e.key === "Tab" && focusedId) {
				e.preventDefault();
				store.addSiblingBelow(focusedId);
				return;
			}

			// Delete / Backspace — confirmed delete via requestDelete (leaf: immediate; non-leaf: dialog)
			if ((e.key === "Delete" || e.key === "Backspace") && focusedId) {
				e.preventDefault();
				store.requestDelete(focusedId);
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

			// Arrow navigation (sibling up/down, enter child, return to parent)
			if (e.key === "ArrowUp" && focusedId) {
				e.preventDefault();
				navigateSibling(focusedId, -1);
				return;
			}
			if (e.key === "ArrowDown" && focusedId) {
				e.preventDefault();
				navigateSibling(focusedId, 1);
				return;
			}
			if (e.key === "ArrowRight" && focusedId) {
				e.preventDefault();
				enterChild(focusedId);
				return;
			}
			if (e.key === "ArrowLeft" && focusedId) {
				e.preventDefault();
				returnToParent(focusedId);
				return;
			}

			// Escape — close rename or deselect
			if (e.key === "Escape") {
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
		return () => document.removeEventListener("keydown", capturingHandler, true);
	}, [deps]);

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
