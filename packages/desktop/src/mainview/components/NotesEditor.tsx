import { useRef, useState } from "react";
import { useCodeMirror } from "../hooks/useCodeMirror";
import { MarkdownRenderer } from "./MarkdownRenderer";

export type NotesViewMode = "edit" | "preview" | "split";

interface NotesEditorProps {
	nodeId: string;
	notes: string;
	onPersist: (nodeId: string, content: string) => void;
	panelWidth: number;
}

const MIN_SPLIT_WIDTH = 560;

export function NotesEditor({
	nodeId,
	notes,
	onPersist,
	panelWidth,
}: NotesEditorProps) {
	const [mode, setMode] = useState<NotesViewMode>("preview");
	const effectiveMode: NotesViewMode =
		mode === "split" && panelWidth < MIN_SPLIT_WIDTH ? "edit" : mode;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-semibold text-rv-text-tertiary uppercase tracking-[0.05em]">
					Notes
				</span>
				<div
					role="tablist"
					aria-label="Notes view mode"
					className="segmented inline-flex border border-rv-border rounded-md overflow-hidden"
				>
					{(["Edit", "Preview", "Split"] as const).map((label) => {
						const value = label.toLowerCase() as NotesViewMode;
						const active = mode === value;
						return (
							<button
								key={value}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setMode(value)}
								className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
									active
										? "bg-[var(--rv-accent-muted)] text-[var(--rv-accent)]"
										: "bg-transparent text-rv-text-secondary hover:text-rv-text-primary"
								}`}
							>
								{label}
							</button>
						);
					})}
				</div>
			</div>
			{mode === "split" && panelWidth < MIN_SPLIT_WIDTH && (
				<div className="text-[11px] text-rv-text-tertiary">
					Panel too narrow for split view.
				</div>
			)}
			{effectiveMode === "preview" ? (
				<PreviewPane notes={notes} />
			) : effectiveMode === "edit" ? (
				<EditorPane nodeId={nodeId} initialDoc={notes} onPersist={onPersist} />
			) : (
				<div className="grid grid-cols-2 gap-2">
					<EditorPane
						nodeId={nodeId}
						initialDoc={notes}
						onPersist={onPersist}
					/>
					<PreviewPane notes={notes} />
				</div>
			)}
		</div>
	);
}

function PreviewPane({ notes }: { notes: string }) {
	if (!notes.trim()) {
		return (
			<div className="text-[13px] text-rv-text-tertiary">
				No notes for this node.
			</div>
		);
	}
	return <MarkdownRenderer content={notes} />;
}

function EditorPane({
	nodeId,
	initialDoc,
	onPersist,
}: {
	nodeId: string;
	initialDoc: string;
	onPersist: (id: string, v: string) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useCodeMirror({
		container: ref,
		nodeId,
		initialDoc,
		onPersist,
		debounceMs: 1000,
		placeholder: "Write notes in markdown…",
	});
	return (
		<div
			ref={ref}
			data-testid="codemirror-container"
			className="min-h-[120px]"
		/>
	);
}
