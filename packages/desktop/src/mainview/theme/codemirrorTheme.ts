import { EditorView } from "@codemirror/view";

export const codemirrorRvTheme = EditorView.theme(
	{
		"&": {
			backgroundColor: "var(--rv-bg-input)",
			color: "var(--rv-text-primary)",
			fontSize: "13px",
			fontFamily: "inherit",
			border: "1px solid var(--rv-border)",
			borderRadius: "6px",
		},
		".cm-content": {
			caretColor: "var(--rv-accent)",
			padding: "12px",
			minHeight: "120px",
		},
		"&.cm-focused": {
			outline: "none",
			borderColor: "var(--rv-border-focus)",
		},
		"&.cm-focused .cm-selectionBackground, ::selection": {
			backgroundColor: "var(--rv-accent-muted)",
		},
		".cm-cursor": {
			borderLeftColor: "var(--rv-accent)",
			borderLeftWidth: "2px",
		},
		".cm-gutters": {
			backgroundColor: "transparent",
			color: "var(--rv-text-tertiary)",
			border: "none",
		},
		".cm-activeLine": {
			backgroundColor: "var(--rv-bg-hover)",
		},
	},
	{ dark: true },
);
