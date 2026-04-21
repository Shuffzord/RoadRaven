import { closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
	bracketMatching,
	defaultHighlightStyle,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import {
	drawSelection,
	EditorView,
	highlightActiveLine,
	keymap,
	placeholder as cmPlaceholder,
} from "@codemirror/view";
import { useEffect, useRef } from "react";
import { codemirrorRvTheme } from "../theme/codemirrorTheme";

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
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			view.destroy();
			viewRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [nodeId, debounceMs, ph]);

	return viewRef;
}
