import type { CSSProperties } from "react";

// Shared chrome for the store-driven modal dialogs (ConfirmationDialog,
// InfoDialog, DiscardChangesDialog) — the `--rv-*` token inline-style
// approach. Only DiscardChangesDialog consumes these so far; the older two
// still inline the same values and can be moved over when they are next
// touched (Phase 2/3 own those files).

export const dialogContentStyle: CSSProperties = {
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
};

export const dialogTitleStyle: CSSProperties = {
	fontSize: 14,
	fontWeight: 600,
	color: "var(--rv-text-primary)",
};

export const dialogDescriptionStyle: CSSProperties = {
	fontSize: 13,
	color: "var(--rv-text-secondary)",
	lineHeight: 1.5,
	marginTop: 8,
};

export const dialogButtonRowStyle: CSSProperties = {
	display: "flex",
	justifyContent: "flex-end",
	gap: 8,
	marginTop: 20,
};

export const dialogSecondaryButtonStyle: CSSProperties = {
	background: "var(--rv-bg-hover)",
	border: "1px solid var(--rv-border)",
	borderRadius: 6,
	padding: "8px 16px",
	fontSize: 13,
	color: "var(--rv-text-primary)",
};

export const dialogPrimaryButtonStyle: CSSProperties = {
	background: "var(--rv-accent)",
	border: "none",
	borderRadius: 6,
	padding: "8px 16px",
	fontSize: 13,
	fontWeight: 600,
	color: "var(--rv-text-on-accent)",
};
