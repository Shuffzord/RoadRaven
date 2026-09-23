import { type RefObject, useCallback, useEffect, useRef } from "react";
import { focusCanvasTabStop } from "../lib/focusHandoff";

/**
 * Edit mode's keyboard contract for the SidePanel (v0.8.1 Phase 5).
 *
 * `E` used to flip a boolean and stop there: the input appeared, the caret
 * did not, and the user still had to reach for the mouse. Leaving edit mode
 * was worse — the input unmounts, so DOM focus fell to `<body>` and the
 * keyboard user was stranded exactly as a rename commit used to strand them
 * on the canvas (RC8).
 *
 * It lives here rather than in SidePanel because SidePanel is already
 * fallow's second-worst function in scope (34 cyclomatic / 40 cognitive) and
 * the plan forbids growing it. The component keeps one hook call, a ref on
 * the title input and `beginEdit` on its two entry points.
 */

/** D-08: `E` must not fire while the user is typing an `e` somewhere. */
function isTextInputFocused(): boolean {
	const el = document.activeElement;
	if (!el || !(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	const tag = el.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function focusAndSelect(input: HTMLInputElement | null): void {
	if (!input) return;
	// preventScroll for the same reason every other programmatic focus in this
	// app passes it: focusing an element outside the visible box scrolls its
	// nearest scroll container (P0-6a).
	input.focus({ preventScroll: true });
	input.select();
}

/**
 * Hand focus back when edit mode closes.
 *
 * Only when focus is nowhere — which is precisely the state the unmounting
 * input leaves behind. If anything holds the caret the user put it there
 * (they clicked into the notes editor, another field, a card) and A8 applies:
 * do not steal it back. The control they came from is preferred; React
 * re-creates the "Edit node" button, so the element that opened edit mode is
 * usually gone by now and the canvas tab stop is the honest fallback.
 */
function restoreEditOrigin(origin: Element | null): void {
	const active = document.activeElement;
	if (active && active !== document.body) return;
	if (
		origin instanceof HTMLElement &&
		origin !== document.body &&
		origin.isConnected
	) {
		origin.focus({ preventScroll: true });
		return;
	}
	focusCanvasTabStop();
}

export interface EditModeFocusDeps {
	/** The panel is open (App keys this off `selectedNodeId`). */
	isOpen: boolean;
	/** A node is selected, so there is something to edit. */
	hasNode: boolean;
	isEditing: boolean;
	setIsEditing: (editing: boolean) => void;
}

export interface EditModeFocus {
	/** Attach to the title `<input>` rendered in edit mode. */
	titleInputRef: RefObject<HTMLInputElement | null>;
	/** Enter edit mode, remembering where focus came from. */
	beginEdit: () => void;
}

export function useEditModeFocus({
	isOpen,
	hasNode,
	isEditing,
	setIsEditing,
}: EditModeFocusDeps): EditModeFocus {
	const titleInputRef = useRef<HTMLInputElement>(null);
	const originRef = useRef<Element | null>(null);
	const wasEditingRef = useRef(false);

	const beginEdit = useCallback(() => {
		// Read at event time: the "Edit node" button unmounts as edit mode
		// opens, so by the time the effect below runs it is already `<body>`.
		originRef.current = document.activeElement;
		setIsEditing(true);
	}, [setIsEditing]);

	// E shortcut to enter edit mode (D-10). Skipped when a text input has
	// focus (D-08 context-aware) or already editing.
	useEffect(() => {
		if (!isOpen || !hasNode || isEditing) return;
		const handler = (e: KeyboardEvent): void => {
			if (e.key !== "e" && e.key !== "E") return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isTextInputFocused()) return;
			e.preventDefault();
			beginEdit();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen, hasNode, isEditing, beginEdit]);

	// The two edges of edit mode, in one place so the component keeps none of
	// them: entering puts a selected caret in the title (so `E` is a single
	// keystroke to retype a node's name), leaving gives focus back.
	useEffect(() => {
		const was = wasEditingRef.current;
		wasEditingRef.current = isEditing;
		if (isEditing && !was) focusAndSelect(titleInputRef.current);
		else if (!isEditing && was) restoreEditOrigin(originRef.current);
	}, [isEditing]);

	return { titleInputRef, beginEdit };
}
