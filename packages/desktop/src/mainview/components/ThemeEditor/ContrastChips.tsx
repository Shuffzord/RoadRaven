import type { CSSProperties } from "react";
import { suggestInk } from "../../../../../../shared/contrast";
import type { ThemeMode } from "../../../../../../shared/themeSchema";
import {
	EDITOR_CHIP_PAIR_ATTR,
	EDITOR_CHIP_STATUS_ATTR,
	EDITOR_CHIP_TESTID,
	EDITOR_SUGGEST_FIX_LABEL,
} from "../../lib/domContract";
import type {
	ChipStatus,
	EditorField,
	PairVerdict,
} from "../../lib/themeEditor";

// The status ink family each verdict borrows (chip fill + edge); the text
// itself stays text-primary so a chip never relies on colour alone.
const STATUS_FAMILY: Record<ChipStatus, string> = {
	pass: "completed",
	warn: "in-progress",
	fail: "blocked",
};

const listStyle: CSSProperties = {
	listStyle: "none",
	margin: "4px 0 0",
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 2,
};

const rowStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 6,
	fontSize: 11,
	lineHeight: 1.4,
	color: "var(--rv-text-secondary)",
};

// Text-primary on the input surface (a registered required pair) with the
// status ink only on the edge and the dot: a theme's badge fills may be
// opaque (Contrast), so text on `-bg` would be an unregistered pair.
const chipStyle = (status: ChipStatus): CSSProperties => ({
	display: "inline-flex",
	alignItems: "center",
	gap: 4,
	padding: "0 6px",
	borderRadius: 999,
	fontWeight: 600,
	fontSize: 10,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--rv-text-primary)",
	background: "var(--rv-bg-input)",
	border: `1px solid var(--rv-status-${STATUS_FAMILY[status]})`,
});

const dotStyle = (status: ChipStatus): CSSProperties => ({
	width: 6,
	height: 6,
	borderRadius: 999,
	background: `var(--rv-status-${STATUS_FAMILY[status]})`,
});

const fixButtonStyle: CSSProperties = {
	marginLeft: "auto",
	padding: "1px 8px",
	fontSize: 11,
	borderRadius: 4,
	border: "1px solid var(--rv-border)",
	background: "var(--rv-bg-hover)",
	color: "var(--rv-text-primary)",
};

const surfaceTagStyle: CSSProperties = {
	marginLeft: "auto",
	fontSize: 10,
	color: "var(--rv-text-tertiary)",
	textDecoration: "underline dotted",
	cursor: "help",
};

interface ContrastChipsProps {
	field: EditorField;
	verdicts: PairVerdict[];
	mode: ThemeMode;
	/** Applies a suggested ink to this field. */
	onSuggest: (hex: string) => void;
}

/**
 * The contrast pairs one field takes part in — ratio, minimum and a
 * pass / warn / fail chip from the shared registry (D3: the same tiers CI
 * gates on). A failing pair where the field is the ink offers "Suggest
 * fix"; where the field is a surface, the fix belongs to the ink field.
 */
export function ContrastChips({
	field,
	verdicts,
	mode,
	onSuggest,
}: ContrastChipsProps) {
	if (verdicts.length === 0) return null;
	return (
		<ul style={listStyle} aria-label={`${field.label} contrast`}>
			{verdicts.map(({ pair, role, finding, status }) => {
				const fix =
					role === "ink" && status !== "pass"
						? suggestInk(finding.ink, finding.surface, pair.min, mode)
						: null;
				return (
					<li key={pair.id} style={rowStyle}>
						<span
							data-testid={EDITOR_CHIP_TESTID}
							{...{
								[EDITOR_CHIP_PAIR_ATTR]: pair.id,
								[EDITOR_CHIP_STATUS_ATTR]: status,
							}}
							style={chipStyle(status)}
						>
							<span aria-hidden="true" style={dotStyle(status)} />
							{status}
						</span>
						<span>{pair.label}</span>
						<span style={{ color: "var(--rv-text-tertiary)" }}>
							{finding.reason
								? "not measurable"
								: `${finding.ratio.toFixed(2)}:1 · min ${pair.min}:1`}
						</span>
						{role === "ink" && status !== "pass" && (
							<button
								type="button"
								style={fixButtonStyle}
								disabled={fix === null}
								title={
									fix === null
										? "No lighter or darker value of this ink reaches the minimum"
										: `Set ${field.label} to ${fix}`
								}
								onClick={() => {
									if (fix !== null) onSuggest(fix);
								}}
							>
								{EDITOR_SUGGEST_FIX_LABEL}
							</button>
						)}
						{role === "surface" && status !== "pass" && (
							<span
								style={surfaceTagStyle}
								title={`${field.label} is the surface here — fix the ink (${pair.ink}) instead`}
							>
								surface
							</span>
						)}
					</li>
				);
			})}
		</ul>
	);
}
