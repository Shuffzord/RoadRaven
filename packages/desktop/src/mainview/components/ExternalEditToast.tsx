import { useRoadmapStore } from "../store/roadmapStore";

/**
 * ExternalEditToast (D-14).
 *
 * Renders a non-blocking toast when an external file change arrives while the
 * user has unsaved local edits (or a save is in flight). Plan 04c's
 * useFileActions hook owns the dirty-vs-clean decision; this component only
 * mirrors the resulting `externalEditPending` store flag.
 *
 * Actions delegate to `resolveExternalEdit` from Plan 04b, which dispatches
 * `roadraven:reload-file` for the "reload" path; the useFileActions effect
 * subscribes to that CustomEvent and calls loadFile via RPC.
 */
export function ExternalEditToast() {
	const pending = useRoadmapStore((s) => s.externalEditPending);
	const resolve = useRoadmapStore((s) => s.resolveExternalEdit);

	if (!pending) return null;

	return (
		<div
			role="alert"
			aria-live="assertive"
			data-testid="external-edit-toast"
			style={{
				position: "fixed",
				bottom: 48,
				left: "50%",
				transform: "translateX(-50%)",
				background: "var(--rv-bg-elevated)",
				border: "1px solid var(--rv-border)",
				borderRadius: 8,
				boxShadow: "var(--rv-shadow-config)",
				padding: "12px 16px",
				display: "flex",
				alignItems: "center",
				gap: 12,
				zIndex: 9000,
			}}
		>
			<svg
				width={14}
				height={14}
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--rv-text-secondary)"
				strokeWidth={2}
				aria-hidden="true"
			>
				<title>External change</title>
				<circle cx={12} cy={12} r={10} />
				<line x1={12} y1={16} x2={12} y2={12} />
				<line x1={12} y1={8} x2={12.01} y2={8} />
			</svg>
			<span style={{ fontSize: 13, color: "var(--rv-text-primary)" }}>
				File changed externally.
			</span>
			<button
				type="button"
				onClick={() => resolve("reload")}
				aria-label="Reload file, discarding your unsaved changes"
				style={{
					background: "var(--rv-bg-hover)",
					border: "1px solid var(--rv-border)",
					borderRadius: 6,
					padding: "4px 8px",
					fontSize: 11,
					fontWeight: 600,
					color: "var(--rv-text-primary)",
				}}
			>
				Reload File
			</button>
			<button
				type="button"
				onClick={() => resolve("keep")}
				aria-label="Keep my changes, overwrite external edit on next save"
				style={{
					background: "var(--rv-bg-hover)",
					border: "1px solid var(--rv-border)",
					borderRadius: 6,
					padding: "4px 8px",
					fontSize: 11,
					fontWeight: 600,
					color: "var(--rv-text-primary)",
				}}
			>
				Keep mine
			</button>
		</div>
	);
}
