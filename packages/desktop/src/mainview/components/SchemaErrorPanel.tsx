interface SchemaErrorPanelProps {
	errors: Array<{ path: string; message: string; code: string }>;
	onDismiss: () => void;
}

export function SchemaErrorPanel({ errors, onDismiss }: SchemaErrorPanelProps) {
	if (errors.length === 0) return null;

	return (
		<div
			className="absolute bottom-0 left-0 right-0 bg-[var(--rv-bg-surface)] border-t-2 border-t-[var(--rv-status-blocked)] z-[20] max-h-[200px] overflow-y-auto"
			role="alert"
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2.5">
				<div className="flex items-center gap-2">
					{/* Warning icon */}
					<svg
						aria-hidden="true"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="var(--rv-status-blocked)"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
						<line x1="12" y1="9" x2="12" y2="13" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
					<span className="text-[14px] font-semibold text-[var(--rv-text-primary)]">
						Schema Error
					</span>
				</div>
				<button
					className="flex items-center justify-center w-7 h-7 rounded-[6px] text-[var(--rv-text-tertiary)] hover:bg-[var(--rv-bg-hover)] hover:text-[var(--rv-text-primary)] transition-colors duration-150"
					type="button"
					onClick={onDismiss}
					aria-label="Dismiss errors"
				>
					<svg
						aria-hidden="true"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{/* Error rows */}
			<div className="px-4 pb-2">
				{errors.map((error) => (
					<div
						key={`${error.code}-${error.path}-${error.message}`}
						className="flex items-start gap-3 py-1.5"
					>
						<span className="text-[11px] font-semibold uppercase text-[var(--rv-status-blocked)] shrink-0">
							ERROR
						</span>
						<span className="text-[12px] text-[var(--rv-text-primary)] flex-1">
							{error.message}
						</span>
						{error.path && (
							<span className="text-[11px] font-[family-name:var(--rv-font-mono,'Space_Grotesk')] text-[var(--rv-text-tertiary)] shrink-0">
								at /{error.path}
							</span>
						)}
					</div>
				))}
			</div>

			{/* Footer */}
			<div className="px-4 py-2 border-t border-[var(--rv-border)]">
				<span className="text-[12px] text-[var(--rv-text-secondary)]">
					Fix the JSON file and save -- the viewer will reload automatically.
				</span>
			</div>
		</div>
	);
}
