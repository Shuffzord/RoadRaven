import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { useRoadmapStore } from "../store/roadmapStore";
import {
	dialogButtonRowStyle,
	dialogContentStyle,
	dialogDescriptionStyle,
	dialogPrimaryButtonStyle,
	dialogSecondaryButtonStyle,
	dialogTitleStyle,
} from "./dialogStyles";

/**
 * Untitled-with-edits prompt (v0.8.2 A1).
 *
 * Opens when store.pendingDiscard is set by ensureSafeToDiscard (New, Open,
 * Close File, window close). Resolves the pending choice:
 *   - "Save As…"   → the guard runs Save As and proceeds only if a path came back
 *   - "Don't save" → proceed, dropping the edits
 *   - "Cancel" / Escape / overlay click → stay on the document
 * Initial focus: Save As… (the non-destructive default).
 */
export function DiscardChangesDialog() {
	const pending = useRoadmapStore((s) => s.pendingDiscard);
	const saveRef = useRef<HTMLButtonElement>(null);

	return (
		<Dialog.Root
			open={!!pending}
			onOpenChange={(open) => {
				if (!open) pending?.resolve("cancel");
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
				<Dialog.Content
					aria-modal="true"
					style={dialogContentStyle}
					// Radix would focus the first tabbable (Don't save); land on Save As…
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						saveRef.current?.focus();
					}}
				>
					<Dialog.Title style={dialogTitleStyle}>
						Save changes to this roadmap?
					</Dialog.Title>
					<Dialog.Description style={dialogDescriptionStyle}>
						This roadmap has not been saved to a file yet. Your edits will be
						lost unless you save them.
					</Dialog.Description>
					<div style={dialogButtonRowStyle}>
						<button
							type="button"
							onClick={() => pending?.resolve("discard")}
							style={{
								...dialogSecondaryButtonStyle,
								color: "var(--rv-status-blocked)",
							}}
						>
							Don't save
						</button>
						<button
							type="button"
							onClick={() => pending?.resolve("cancel")}
							style={dialogSecondaryButtonStyle}
						>
							Cancel
						</button>
						<button
							ref={saveRef}
							type="button"
							onClick={() => pending?.resolve("save")}
							style={dialogPrimaryButtonStyle}
						>
							Save As…
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
