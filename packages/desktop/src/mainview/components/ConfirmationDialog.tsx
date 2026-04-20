import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

/**
 * Non-leaf delete confirmation (EDIT-03).
 *
 * Opens when store.pendingConfirmation is set (requestDelete on a non-leaf).
 * - Heading: "Delete node and N children?" where N = deletedCount (descendant count).
 * - Initial focus: Keep Node button (safer default).
 * - Radix Dialog provides focus trap, aria-modal, Escape-to-close via onOpenChange.
 */
export function ConfirmationDialog() {
	const pending = useRoadmapStore((s) => s.pendingConfirmation);
	const cancelDelete = useRoadmapStore((s) => s.cancelDelete);
	const confirmDelete = useRoadmapStore((s) => s.confirmDelete);
	const keepRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (pending) {
			// Radix auto-focuses content; override to put focus on Keep Node (safer default)
			const id = setTimeout(() => keepRef.current?.focus(), 0);
			return () => clearTimeout(id);
		}
		return undefined;
	}, [pending]);

	return (
		<Dialog.Root
			open={!!pending}
			onOpenChange={(open) => {
				if (!open) cancelDelete();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay
					className="fixed inset-0 z-[9999] bg-black/60"
				/>
				<Dialog.Content
					aria-modal="true"
					style={{
						position: "fixed",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						width: 400,
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
						<title>Warning</title>
						<path d="M12 9v4" />
						<path d="M12 17h.01" />
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
					</svg>
					<Dialog.Title
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--rv-text-primary)",
							marginTop: 12,
						}}
					>
						{pending
							? `Delete node and ${pending.deletedCount} ${pending.deletedCount === 1 ? "child" : "children"}?`
							: ""}
					</Dialog.Title>
					<Dialog.Description
						style={{
							fontSize: 13,
							color: "var(--rv-text-secondary)",
							lineHeight: 1.5,
							marginTop: 8,
						}}
					>
						{pending
							? `This will permanently remove "${pending.nodeTitle}" and all nodes in its subtree. This cannot be undone.`
							: ""}
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
							ref={keepRef}
							type="button"
							onClick={() => cancelDelete()}
							style={{
								background: "var(--rv-bg-hover)",
								border: "1px solid var(--rv-border)",
								borderRadius: 6,
								padding: "8px 16px",
								fontSize: 13,
								color: "var(--rv-text-primary)",
							}}
						>
							Keep Node
						</button>
						<button
							type="button"
							onClick={() => confirmDelete()}
							style={{
								background: "var(--rv-status-blocked)",
								border: "none",
								borderRadius: 6,
								padding: "8px 16px",
								fontSize: 13,
								fontWeight: 600,
								color: "var(--rv-text-on-accent)",
							}}
						>
							Delete
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
