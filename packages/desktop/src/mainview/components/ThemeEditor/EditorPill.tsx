import { type CSSProperties, forwardRef } from "react";
import { EDITOR_PILL_TESTID, editorPillLabel } from "../../lib/domContract";

// Bottom-right, above the status bar, beside where toasts stack (they are
// transient; the pill is not). Above the toast stack's z-index (9000).
const pillStyle: CSSProperties = {
	position: "fixed",
	right: 16,
	bottom: 48,
	zIndex: 9500,
	padding: "6px 14px",
	borderRadius: 999,
	fontSize: 12,
	fontWeight: 600,
	background: "var(--rv-bg-elevated)",
	border: "1px solid var(--rv-border)",
	boxShadow: "var(--rv-shadow-config)",
	color: "var(--rv-text-primary)",
};

interface EditorPillProps {
	themeName: string;
	onShow: () => void;
}

/** What the hidden editor collapses to; activating it restores the dialog. */
export const EditorPill = forwardRef<HTMLButtonElement, EditorPillProps>(
	function EditorPill({ themeName, onShow }, ref) {
		return (
			<button
				ref={ref}
				type="button"
				data-testid={EDITOR_PILL_TESTID}
				style={pillStyle}
				onClick={onShow}
			>
				{editorPillLabel(themeName)}
			</button>
		);
	},
);
