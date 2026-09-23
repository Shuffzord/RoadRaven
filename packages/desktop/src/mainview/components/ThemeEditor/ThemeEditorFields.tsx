import { type CSSProperties, useId, useState } from "react";
import type { ThemeFile } from "../../../../../../shared/themeSchema";
import { EDITOR_ADVANCED_LABEL } from "../../lib/domContract";
import {
	ADVANCED_GROUPS,
	type EditorField,
	explicitValue,
	type FieldGroup,
	REQUIRED_FIELDS,
	type ThemeVerdicts,
} from "../../lib/themeEditor";
import { ColorField } from "./ColorField";

const groupStyle: CSSProperties = {
	margin: 0,
	padding: 0,
	border: 0,
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: 6,
};

const legendStyle: CSSProperties = {
	padding: 0,
	marginBottom: 4,
	fontSize: 11,
	fontWeight: 600,
	letterSpacing: "0.04em",
	textTransform: "uppercase",
	color: "var(--rv-text-tertiary)",
};

const advancedButtonStyle: CSSProperties = {
	alignSelf: "flex-start",
	background: "var(--rv-bg-hover)",
	border: "1px solid var(--rv-border)",
	borderRadius: 6,
	padding: "6px 12px",
	fontSize: 12,
	color: "var(--rv-text-primary)",
};

interface ThemeEditorFieldsProps {
	draft: ThemeFile;
	verdicts: ThemeVerdicts;
	onChange: (token: string, value: string | null) => void;
}

/**
 * The twelve required colours first, then an "Advanced" disclosure with
 * every optional token grouped, each showing its derived value until the
 * user sets it (D1-B).
 */
export function ThemeEditorFields({
	draft,
	verdicts,
	onChange,
}: ThemeEditorFieldsProps) {
	const [advanced, setAdvanced] = useState(false);
	const advancedId = useId();

	const renderField = (field: EditorField) => (
		<ColorField
			key={field.token}
			field={field}
			explicit={explicitValue(draft, field)}
			painted={verdicts.resolved[field.token]}
			verdicts={verdicts.byToken[field.token]}
			mode={draft.meta.mode}
			onChange={onChange}
		/>
	);

	const renderGroup = (group: FieldGroup) => (
		<fieldset key={group.id} style={groupStyle}>
			<legend style={legendStyle}>{group.label}</legend>
			{group.fields.map(renderField)}
		</fieldset>
	);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
			{renderGroup({
				id: "required",
				label: "Colours",
				fields: REQUIRED_FIELDS,
			})}
			<button
				type="button"
				style={advancedButtonStyle}
				aria-expanded={advanced}
				aria-controls={advancedId}
				onClick={() => setAdvanced((v) => !v)}
			>
				{EDITOR_ADVANCED_LABEL}
			</button>
			{advanced && (
				<div
					id={advancedId}
					style={{ display: "flex", flexDirection: "column", gap: 14 }}
				>
					{ADVANCED_GROUPS.map(renderGroup)}
				</div>
			)}
		</div>
	);
}
