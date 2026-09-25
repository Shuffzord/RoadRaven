import { UPDATE_PILL_TESTID } from "../lib/domContract";
import { restartToUpdate } from "../lib/updateActions";
import { useUpdateStore } from "../store/updateStore";

/**
 * Status-bar pill (v0.8.5): shown only once an update is downloaded. A click
 * restarts into it through the same action as Preferences, so the unsaved
 * work guard runs first.
 */
export function UpdatePill() {
	const state = useUpdateStore((s) => s.state);
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
				display: "inline-flex",
				alignItems: "center",
				cursor: "pointer",
				fontSize: 11,
				color: "var(--rv-status-completed)",
				borderRadius: 4,
				padding: "2px 4px",
				userSelect: "none",
				background: "none",
				border: "none",
			}}
			className="hover:bg-[var(--rv-bg-hover)] transition-colors duration-100"
		>
			● Update ready
		</button>
	);
}
