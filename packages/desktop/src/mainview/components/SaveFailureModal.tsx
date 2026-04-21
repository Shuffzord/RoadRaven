import * as Dialog from "@radix-ui/react-dialog";
import { useRoadmapStore } from "../store/roadmapStore";

/**
 * SaveFailureModal (D-15 — 3rd consecutive failure).
 *
 * Opens when store.saveState === "error-modal". Offers three exits:
 *   - Retry Save  → dispatches roadraven:trigger-save (useAutosave handles)
 *   - Save As…    → dispatches roadraven:request-save-as (Plan 04c wires up)
 *   - Dismiss     → returns to error-manual (indicator remains clickable)
 *
 * File path rendering uses direction:rtl + ellipsis so the filename stays
 * visible when long paths overflow.
 */
export function SaveFailureModal() {
	const saveState = useRoadmapStore((s) => s.saveState);
	const lastSaveError = useRoadmapStore((s) => s.lastSaveError);
	const filePath = useRoadmapStore((s) => s.filePath);
	const open = saveState === "error-modal";

	const retry = () => useRoadmapStore.getState().triggerSave();
	const saveAs = () => {
		// Plan 04c wires the actual saveFileAs RPC. Emit a CustomEvent for that
		// handler to subscribe to; for now the indicator returns to error-manual
		// so the user can keep attempting retries.
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("roadraven:request-save-as"));
		}
		useRoadmapStore.getState().setSaveState("error-manual");
	};
	const dismiss = () => useRoadmapStore.getState().setSaveState("error-manual");

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(v) => {
				if (!v) dismiss();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
				<Dialog.Content
					aria-modal="true"
					style={{
						position: "fixed",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						width: 440,
						maxWidth: "calc(100vw - 48px)",
						background: "var(--rv-bg-elevated)",
						border: "1px solid var(--rv-border)",
						borderRadius: 12,
						boxShadow: "var(--rv-shadow-config)",
						padding: 24,
						zIndex: 10000,
					}}
				>
					<svg
						width={20}
						height={20}
						viewBox="0 0 24 24"
						fill="none"
						stroke="var(--rv-status-blocked)"
						strokeWidth={2}
						aria-hidden="true"
					>
						<title>Error</title>
						<circle cx={12} cy={12} r={10} />
						<line x1={15} y1={9} x2={9} y2={15} />
						<line x1={9} y1={9} x2={15} y2={15} />
					</svg>
					<Dialog.Title
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--rv-text-primary)",
							marginTop: 12,
						}}
					>
						Unable to save
					</Dialog.Title>
					<div
						style={{
							fontFamily: "monospace",
							fontSize: 11,
							color: "var(--rv-text-secondary)",
							direction: "rtl",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							marginTop: 8,
						}}
					>
						{filePath ?? "(untitled)"}
					</div>
					<Dialog.Description
						style={{
							fontSize: 13,
							color: "var(--rv-text-secondary)",
							lineHeight: 1.5,
							marginTop: 8,
						}}
					>
						{lastSaveError?.message ??
							"RoadRaven could not write changes to disk. The file may be locked, moved, or the disk is full."}
					</Dialog.Description>
					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							gap: 8,
							marginTop: 20,
						}}
					>
						<button
							type="button"
							onClick={dismiss}
							style={{
								background: "transparent",
								border: "none",
								padding: "8px 8px",
								color: "var(--rv-text-tertiary)",
								fontSize: 13,
							}}
						>
							Dismiss
						</button>
						<button
							type="button"
							onClick={saveAs}
							style={{
								background: "var(--rv-bg-hover)",
								border: "1px solid var(--rv-border)",
								borderRadius: 6,
								padding: "8px 16px",
								fontSize: 13,
								color: "var(--rv-text-primary)",
							}}
						>
							Save As…
						</button>
						<button
							type="button"
							onClick={retry}
							style={{
								background: "var(--rv-accent)",
								border: "none",
								borderRadius: 6,
								padding: "8px 16px",
								fontSize: 13,
								fontWeight: 600,
								color: "var(--rv-text-on-accent)",
							}}
						>
							Retry Save
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
