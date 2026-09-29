import type { CSSProperties } from "react";
import { UPDATE_PILL_TESTID } from "../lib/domContract";
import { restartToUpdate } from "../lib/updateActions";
import { useUpdateStore } from "../store/updateStore";

/**
 * Status-bar pill (v0.8.5; v0.8.7 adds the download phase): reports a
 * download in progress and, once it is done, offers the restart. A click on
 * the ready pill runs the same action as Preferences and the update card, so
 * the unsaved work guard runs first. Errors stay in the card and
 * Preferences › About.
 */

const pillStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	fontSize: 11,
	borderRadius: 4,
	padding: "2px 4px",
	userSelect: "none",
	background: "none",
	border: "none",
};

export function UpdatePill() {
	const state = useUpdateStore((s) => s.state);

	if (state.status === "downloading") {
		// The delta-patch path reports no byte progress: stay indeterminate.
		const percent =
			state.progress > 0 ? ` ${Math.round(state.progress)}%` : "…";
		return (
			<span
				data-testid={UPDATE_PILL_TESTID}
				title={`Downloading version ${state.version}.`}
				style={{ ...pillStyle, color: "var(--rv-text-tertiary)" }}
			>
				↓ Downloading{percent}
			</span>
		);
	}
	if (state.status !== "ready") return null;

	const tooltip = `Version ${state.version} is downloaded. Click to restart and update.`;
	return (
		<button
			type="button"
			data-testid={UPDATE_PILL_TESTID}
			aria-label={tooltip}
			title={tooltip}
			onClick={() => void restartToUpdate()}
			style={{
				...pillStyle,
				cursor: "pointer",
				color: "var(--rv-status-completed)",
			}}
			className="hover:bg-[var(--rv-bg-hover)] transition-colors duration-100"
		>
			● Update ready
		</button>
	);
}
