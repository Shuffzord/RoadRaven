import { type CSSProperties, useId, useState } from "react";
import { parseColor, toHex } from "../../../../../../shared/contrast";
import type { ThemeMode } from "../../../../../../shared/themeSchema";
import {
	EDITOR_DERIVED_TAG,
	EDITOR_FIELD_ATTR,
	EDITOR_RESET_LABEL,
	editorSwatchLabel,
} from "../../lib/domContract";
import {
	type EditorField,
	isValidFieldValue,
	type PairVerdict,
} from "../../lib/themeEditor";
import { ContrastChips } from "./ContrastChips";

const wrapperStyle: CSSProperties = {
	paddingBottom: 8,
	borderBottom: "1px solid var(--rv-border-subtle)",
};

const rowStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "28px minmax(0, 1fr) auto",
	alignItems: "center",
	gap: 8,
	minHeight: 32,
};

const swatchStyle: CSSProperties = {
	width: 28,
	height: 28,
	padding: 0,
	border: "1px solid var(--rv-border)",
	borderRadius: 6,
	background: "var(--rv-bg-input)",
};

const labelStyle: CSSProperties = {
	fontSize: 13,
	color: "var(--rv-text-primary)",
	display: "block",
};

const tokenStyle: CSSProperties = {
	fontSize: 10,
	fontFamily: "monospace",
	color: "var(--rv-text-tertiary)",
	display: "block",
};

const inputStyle = (derived: boolean, wide: boolean): CSSProperties => ({
	width: wide ? 200 : 110,
	height: 28,
	padding: "0 8px",
	fontSize: 12,
	fontFamily: "monospace",
	background: "var(--rv-bg-input)",
	border: "1px solid var(--rv-border)",
	borderRadius: 6,
	color: derived ? "var(--rv-text-tertiary)" : "var(--rv-text-primary)",
});

const tagStyle: CSSProperties = {
	fontSize: 10,
	color: "var(--rv-text-tertiary)",
	textTransform: "uppercase",
	letterSpacing: "0.04em",
};

const resetStyle: CSSProperties = {
	fontSize: 11,
	padding: "1px 6px",
	borderRadius: 4,
	border: "1px solid var(--rv-border)",
	background: "var(--rv-bg-hover)",
	color: "var(--rv-text-primary)",
};

/** The `#rrggbb` the native picker can show (alpha dropped). */
function swatchValue(value: string | undefined): string {
	const c = parseColor(value);
	return toHex(c ? [c[0], c[1], c[2]] : [0, 0, 0]);
}

interface ColorFieldProps {
	field: EditorField;
	/** The file's own value; undefined when the token is derived. */
	explicit: string | undefined;
	/** What is painted: `explicit`, else the derived value (may be none). */
	painted: string | undefined;
	verdicts: PairVerdict[] | undefined;
	mode: ThemeMode;
	/** `null` resets an optional field to its derived value. */
	onChange: (token: string, value: string | null) => void;
}

/**
 * One theme field: a native colour picker (colour tokens only) and a text
 * input, the human label with the token as sublabel, a "derived" tag or a
 * reset button, and the field's contrast chips. Invalid text keeps the last
 * accepted value painted and marks the input; leaving the field restores it.
 */
export function ColorField({
	field,
	explicit,
	painted,
	verdicts,
	mode,
	onChange,
}: ColorFieldProps) {
	const id = useId();
	const derived = explicit === undefined;
	const value = painted ?? "";
	// Local text so an in-progress (invalid) edit is not clobbered by the
	// painted value; re-synced whenever the painted value itself changes.
	const [text, setText] = useState(value);
	const [seen, setSeen] = useState(value);
	if (value !== seen) {
		setSeen(value);
		setText(value);
	}
	const invalid = text !== value && !isValidFieldValue(field, text.trim());
	const isColour = field.section === "colors";

	return (
		<div style={wrapperStyle} {...{ [EDITOR_FIELD_ATTR]: field.token }}>
			<div style={rowStyle}>
				{isColour ? (
					<input
						type="color"
						aria-label={editorSwatchLabel(field.label)}
						value={swatchValue(value)}
						onChange={(e) => onChange(field.token, e.target.value)}
						style={swatchStyle}
					/>
				) : (
					<span aria-hidden="true" />
				)}
				<div style={{ minWidth: 0 }}>
					<label htmlFor={`${id}-value`} style={labelStyle}>
						{field.label}
					</label>
					<span id={`${id}-token`} style={tokenStyle}>
						{field.token}
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<input
						id={`${id}-value`}
						type="text"
						spellCheck={false}
						{...{ [EDITOR_FIELD_ATTR]: field.token }}
						aria-describedby={`${id}-token`}
						aria-invalid={invalid || undefined}
						placeholder={
							derived && painted === undefined ? "browser default" : undefined
						}
						value={text}
						onChange={(e) => {
							setText(e.target.value);
							onChange(field.token, e.target.value);
						}}
						onBlur={() => {
							if (invalid) setText(value);
						}}
						style={inputStyle(derived, !isColour)}
					/>
					{derived && !field.required && (
						<span style={tagStyle}>{EDITOR_DERIVED_TAG}</span>
					)}
					{!derived && !field.required && (
						<button
							type="button"
							style={resetStyle}
							onClick={() => onChange(field.token, null)}
						>
							{EDITOR_RESET_LABEL}
						</button>
					)}
				</div>
			</div>
			{verdicts && (
				<ContrastChips
					field={field}
					verdicts={verdicts}
					mode={mode}
					onSuggest={(hex) => onChange(field.token, hex)}
				/>
			)}
		</div>
	);
}
