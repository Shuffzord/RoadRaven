import { closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
	bracketMatching,
	defaultHighlightStyle,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { Annotation, EditorState } from "@codemirror/state";
import {
	placeholder as cmPlaceholder,
	drawSelection,
	EditorView,
	highlightActiveLine,
	keymap,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { codemirrorRvTheme } from "../theme/codemirrorTheme";

// Marks transactions that sync an external notes change into the editor, so
// the update listener doesn't persist them straight back.
const externalSync = Annotation.define<boolean>();

interface Options {
	container: React.RefObject<HTMLDivElement | null>;
	nodeId: string;
	initialDoc: string;
	onPersist: (nodeId: string, content: string) => void;
	debounceMs?: number;
	placeholder?: string;
}

export function useCodeMirror({
	container,
	nodeId,
	initialDoc,
	onPersist,
	debounceMs = 1000,
	placeholder: ph = "Write notes in markdown…",
}: Options) {
	const viewRef = useRef<EditorView | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onPersistRef = useRef(onPersist);
	onPersistRef.current = onPersist;

	// biome-ignore lint/correctness/useExhaustiveDependencies: initialDoc seeds the editor on mount only — CodeMirror owns the doc after that; container is a ref.
	useEffect(() => {
		if (!container.current) return;

		const extensions = [
			history(),
			drawSelection(),
			indentOnInput(),
			bracketMatching(),
			closeBrackets(),
			highlightActiveLine(),
			markdown({ base: markdownLanguage, codeLanguages: [] }),
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
			keymap.of([...defaultKeymap, ...historyKeymap]),
			cmPlaceholder(ph),
			EditorView.lineWrapping,
			codemirrorRvTheme,
			EditorView.updateListener.of((update) => {
				if (!update.docChanged) return;
				if (update.transactions.some((tr) => tr.annotation(externalSync)))
					return;
				if (timerRef.current) clearTimeout(timerRef.current);
				const content = update.state.doc.toString();
				timerRef.current = setTimeout(() => {
					onPersistRef.current(nodeId, content);
					timerRef.current = null;
				}, debounceMs);
			}),
		];

		const view = new EditorView({
			state: EditorState.create({ doc: initialDoc, extensions }),
			parent: container.current,
		});
		viewRef.current = view;

		return () => {
			// Flush any in-flight edit before tearing the view down. Without this,
			// the user's last <debounceMs> of typing is silently discarded when the
			// hook re-mounts on nodeId change (or when SidePanel exits edit mode).
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
				onPersistRef.current(nodeId, view.state.doc.toString());
			}
			view.destroy();
			viewRef.current = null;
		};
	}, [nodeId, debounceMs, ph]);

	// Sync notes changed from outside (e.g. an agent's updateNodeNotes) into the
	// open editor; otherwise the next keystroke persists the stale doc over them.
	// If a local edit is still pending its debounced persist, keep the user's
	// text instead — clobbering mid-typing is worse, and that persist wins.
	useEffect(() => {
		const view = viewRef.current;
		if (!view || timerRef.current) return;
		if (view.state.doc.toString() === initialDoc) return;
		const head = Math.min(view.state.selection.main.head, initialDoc.length);
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: initialDoc },
			selection: { anchor: head },
			annotations: externalSync.of(true),
		});
	}, [initialDoc]);

	return viewRef;
}
