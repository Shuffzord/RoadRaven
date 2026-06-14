import * as Dialog from "@radix-ui/react-dialog";

/**
 * InfoDialog — generic, controlled placeholder/info modal.
 *
 * Unlike ConfirmationDialog (coupled to the roadmap store), this is driven
 * entirely by props so any caller can parameterize title + body and own its
 * own open/close state. Radix Dialog provides focus trap, aria-modal,
 * Escape-to-close (via onOpenChange), and the overlay. Styling mirrors
 * ConfirmationDialog's `--rv-*` token inline-style approach.
 */
export function InfoDialog({
	open,
	onClose,
	title,
	body,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	body: string;
}) {
	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
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
					<Dialog.Title
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--rv-text-primary)",
						}}
					>
						{title}
					</Dialog.Title>
					<Dialog.Description
						style={{
							fontSize: 13,
							color: "var(--rv-text-secondary)",
							lineHeight: 1.5,
							marginTop: 8,
						}}
					>
						{body}
					</Dialog.Description>
					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							marginTop: 20,
						}}
					>
						<button
							type="button"
							onClick={() => onClose()}
							style={{
								background: "var(--rv-bg-hover)",
								border: "1px solid var(--rv-border)",
								borderRadius: 6,
								padding: "8px 16px",
								fontSize: 13,
								color: "var(--rv-text-primary)",
							}}
						>
							Close
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
