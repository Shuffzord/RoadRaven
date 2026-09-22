import type { CSSProperties } from "react";

// Shared chrome for the modal dialogs (DiscardChangesDialog,
// PreferencesDialog) — the `--rv-*` token inline-style approach.
// ConfirmationDialog still inlines the same values and can be moved over
// when it is next touched.

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

// -- Preferences dialog (v0.8.2 Phase 4): sections of labelled fields --------

export const dialogScrollContentStyle: CSSProperties = {
	...dialogContentStyle,
	width: 460,
	maxHeight: "calc(100vh - 48px)",
	overflowY: "auto",
};

export const dialogSectionStyle: CSSProperties = {
	marginTop: 16,
	paddingTop: 14,
	borderTop: "1px solid var(--rv-border-subtle)",
};

export const dialogSectionHeadingStyle: CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	letterSpacing: "0.04em",
	textTransform: "uppercase",
	color: "var(--rv-text-tertiary)",
	marginBottom: 10,
};

export const dialogFieldRowStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 12,
	minHeight: 28,
};

export const dialogFieldLabelStyle: CSSProperties = {
	fontSize: 13,
	color: "var(--rv-text-primary)",
};

export const dialogHelperTextStyle: CSSProperties = {
	fontSize: 12,
	lineHeight: 1.4,
	color: "var(--rv-text-tertiary)",
	marginTop: 6,
};

export const dialogErrorTextStyle: CSSProperties = {
	...dialogHelperTextStyle,
	color: "var(--rv-status-blocked)",
};

export const dialogInputStyle: CSSProperties = {
	width: 120,
	height: 28,
	padding: "0 8px",
	fontSize: 13,
	background: "var(--rv-bg-input)",
	border: "1px solid var(--rv-border)",
	borderRadius: 6,
	color: "var(--rv-text-primary)",
};

export const dialogActionRowStyle: CSSProperties = {
	display: "flex",
	gap: 8,
	marginTop: 10,
};
