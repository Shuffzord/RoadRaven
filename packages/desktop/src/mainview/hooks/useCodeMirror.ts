import { closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
	bracketMatching,
	defaultHighlightStyle,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { Annotation, EditorState, Transaction } from "@codemirror/state";
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

const CONFLICT_SEPARATOR =
	"\n\n---\n\n<!-- notes also changed outside the editor; their version follows -->\n\n";

// Fold notes that changed in the store while a local edit was pending into
// the text the user is saving, so neither side is silently dropped. Agents
// almost always append, so a store value that still starts with the doc the
// user began editing from means "append its tail"; anything else is a real
// conflict and both versions are kept, user's first, behind a visible
// separator for the user to reconcile. Cheaper and more predictable than a
// three-way text merge for the append-only traffic this actually sees.
function mergeNotes(base: string, local: string, external: string): string {
	if (external === base) return local;
	if (external.startsWith(base)) return local + external.slice(base.length);
	return local + CONFLICT_SEPARATOR + external;
}

// Replace the editor doc with notes that came from outside the editor: not
// persisted back (externalSync), and kept out of undo history so Ctrl+Z can't
// revert an agent's change that the next persist would then delete.
function syncDoc(view: EditorView, doc: string) {
	if (view.state.doc.toString() === doc) return;
	view.dispatch({
		changes: { from: 0, to: view.state.doc.length, insert: doc },
		selection: { anchor: Math.min(view.state.selection.main.head, doc.length) },
		annotations: [externalSync.of(true), Transaction.addToHistory.of(false)],
	});
}

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
	// Latest store notes, and the notes the editor last agreed with (the base a
	// pending local edit started from) — see mergeNotes. Updated in effects, not
	// during render, so a node switch's cleanup flush still sees the old node's.
	const latestDocRef = useRef(initialDoc);
	const baseDocRef = useRef(initialDoc);

	// biome-ignore lint/correctness/useExhaustiveDependencies: initialDoc seeds the editor on mount only — CodeMirror owns the doc after that; container is a ref.
	useEffect(() => {
		if (!container.current) return;
		latestDocRef.current = initialDoc;
		baseDocRef.current = initialDoc;

		const persist = (content: string) => {
			const saved = mergeNotes(
				baseDocRef.current,
				content,
				latestDocRef.current,
			);
			baseDocRef.current = saved;
			onPersistRef.current(nodeId, saved);
			return saved;
		};

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
					timerRef.current = null;
					syncDoc(update.view, persist(content));
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
				persist(view.state.doc.toString());
			}
			view.destroy();
			viewRef.current = null;
		};
	}, [nodeId, debounceMs, ph]);

	// Sync notes changed from outside (e.g. an agent's updateNodeNotes) into the
	// open editor; otherwise the next keystroke persists the stale doc over them.
	// If a local edit is still pending, don't clobber mid-typing — the pending
	// persist merges the external change in (mergeNotes) and syncs afterwards.
	useEffect(() => {
		latestDocRef.current = initialDoc;
		const view = viewRef.current;
		if (!view || timerRef.current) return;
		baseDocRef.current = initialDoc;
		syncDoc(view, initialDoc);
	}, [initialDoc]);

	return viewRef;
}
