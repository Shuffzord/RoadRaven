/**
 * The pure half of the theme editor (v0.8.3 Phase 5, D1-B / D3): which
 * fields exist and in what order, which contrast pairs a token takes part
 * in, the live verdicts (the same registry and tiers CI gates on), and the
 * draft reducer. No React, no store, no I/O — the dialog renders this.
 */

import { type Finding, lintTheme } from "../../../../../shared/contrast";
import {
	CONTRAST_PAIRS,
	type ContrastPair,
	STATUS_IDS,
	type StatusId,
} from "../../../../../shared/themeContract";
import {
	COLOR_VALUE_PATTERN,
	FONT_KEYS,
	FONT_STACK_PATTERN,
	type FontKey,
	isSafeCssValue,
	PX_VALUE_PATTERN,
	REQUIRED_COLOR_KEYS,
	resolveTheme,
	SHADOW_KEYS,
	SHADOW_VALUE_PATTERN,
	SHAPE_KEYS,
	type ShadowKey,
	type ShapeKey,
	slugifyThemeId,
	type ThemeFile,
} from "../../../../../shared/themeSchema";

export type FieldSection = "colors" | "shape" | "fonts" | "shadows";

export interface EditorField {
	/** The `--rv-*` token name: the field's identity and its pair key. */
	token: string;
	/** Key inside the file's section (`bg-base`, `radius-md`, `sans`, `node`). */
	key: string;
	section: FieldSection;
	/** Human name; the token is the sublabel. Unique across all fields. */
	label: string;
	/** One of the twelve a file must set: never derived, never reset. */
	required: boolean;
}

export interface FieldGroup {
	id: string;
	label: string;
	fields: EditorField[];
}

const REQUIRED = new Set(REQUIRED_COLOR_KEYS);

function colour(key: string, label: string): EditorField {
	return {
		token: `--rv-${key}`,
		key,
		section: "colors",
		label,
		required: REQUIRED.has(key),
	};
}

const REQUIRED_LABELS: Record<string, string> = {
	"bg-base": "App background",
	"bg-canvas": "Canvas",
	"bg-node": "Card",
	"text-primary": "Text",
	"text-secondary": "Secondary text",
	border: "Border",
	"border-focus": "Focus border",
	accent: "Accent",
	"status-not-started": "Not started",
	"status-in-progress": "In progress",
	"status-completed": "Completed",
	"status-blocked": "Blocked",
};

const STATUS_LABEL: Record<StatusId, string> = {
	"not-started": "Not started",
	"in-progress": "In progress",
	completed: "Completed",
	blocked: "Blocked",
};

const SHAPE_LABEL: Record<ShapeKey, string> = {
	"border-width": "Border width",
	"radius-xs": "Radius XS",
	"radius-sm": "Radius S",
	"radius-md": "Radius M",
	"radius-lg": "Radius L",
	"radius-xl": "Radius XL",
	"radius-pill": "Radius pill",
};

const FONT_LABEL: Record<FontKey, string> = {
	sans: "Body font",
	heading: "Heading font",
};

const SHADOW_LABEL: Record<ShadowKey, string> = {
	node: "Card shadow",
	"node-hover": "Hovered card shadow",
	panel: "Panel shadow",
	config: "Config shadow",
};

/** The twelve required colours, in contract order — the top of the dialog. */
export const REQUIRED_FIELDS: EditorField[] = REQUIRED_COLOR_KEYS.map((key) =>
	colour(key, REQUIRED_LABELS[key] ?? key),
);

const statusGroup = (
	id: string,
	label: string,
	suffix: string,
	part: string,
): FieldGroup => ({
	id,
	label,
	fields: STATUS_IDS.map((s) =>
		colour(`status-${s}-${suffix}`, `${STATUS_LABEL[s]} ${part}`),
	),
});

/** Everything under the "Advanced" disclosure, in display order. */
export const ADVANCED_GROUPS: FieldGroup[] = [
	{
		id: "surfaces",
		label: "Surfaces",
		fields: [
			colour("bg-surface", "Surface"),
			colour("bg-input", "Input"),
			colour("bg-statusbar", "Status bar"),
			colour("bg-elevated", "Elevated (menus, dialogs)"),
			colour("bg-hover", "Hover"),
			colour("bg-active", "Active"),
			colour("bg-node-hover", "Hovered card"),
			colour("bg-toolbar", "Toolbar"),
			colour("bg-panel", "Side panel"),
			colour("bg-config", "Config panel"),
		],
	},
	{
		id: "text",
		label: "Text",
		fields: [
			colour("text-tertiary", "Tertiary text"),
			colour("text-on-accent", "Text on accent"),
			colour("text-node", "Card text"),
		],
	},
	{
		id: "borders",
		label: "Borders",
		fields: [colour("border-subtle", "Subtle border")],
	},
	{
		id: "accent",
		label: "Accent",
		fields: [
			colour("accent-hover", "Accent hover"),
			colour("accent-muted", "Accent fill"),
			colour("accent-border", "Accent border"),
		],
	},
	{
		id: "canvas",
		label: "Canvas",
		fields: [
			colour("dot-grid", "Dot grid"),
			colour("line-connector", "Connector"),
		],
	},
	statusGroup("status-card", "Status — card stripe", "card", "stripe"),
	statusGroup("status-fg", "Status — badge text", "fg", "badge text"),
	statusGroup("status-bg", "Status — badge fill", "bg", "badge fill"),
	{
		id: "rings",
		label: "Rings",
		fields: [
			colour("pulse", "Live pulse ring"),
			colour("search", "Search ring"),
		],
	},
	{
		id: "scrollbar",
		label: "Scrollbar",
		fields: [
			colour("scrollbar-track", "Scrollbar track"),
			colour("scrollbar-thumb", "Scrollbar thumb"),
		],
	},
	{
		id: "plugin",
		label: "Plugin glyphs",
		fields: [
			colour("plugin-claude-code-bg", "Claude Code glyph"),
			colour("plugin-github-actions-bg", "GitHub Actions glyph"),
			colour("plugin-default-bg", "Default plugin glyph"),
		],
	},
	{
		id: "shape",
		label: "Shape",
		fields: SHAPE_KEYS.map((key) => ({
			token: `--rv-${key}`,
			key,
			section: "shape",
			label: SHAPE_LABEL[key],
			required: false,
		})),
	},
	{
		id: "fonts",
		label: "Fonts",
		fields: FONT_KEYS.map((key) => ({
			token: `--rv-font-${key}`,
			key,
			section: "fonts",
			label: FONT_LABEL[key],
			required: false,
		})),
	},
	{
		id: "shadows",
		label: "Shadows",
		fields: SHADOW_KEYS.map((key) => ({
			token: `--rv-shadow-${key}`,
			key,
			section: "shadows",
			label: SHADOW_LABEL[key],
			required: false,
		})),
	},
];

/** Every group in display order: the required twelve, then Advanced. */
export const FIELD_GROUPS: FieldGroup[] = [
	{ id: "required", label: "Colours", fields: REQUIRED_FIELDS },
	...ADVANCED_GROUPS,
];

const FIELD_BY_TOKEN = new Map(
	FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.token, f]),
);

export function fieldByToken(token: string): EditorField | undefined {
	return FIELD_BY_TOKEN.get(token);
}

export type PairRole = "ink" | "surface";

/** The pairs a token takes part in, as the ink or as a surface layer. */
export function pairsForToken(
	token: string,
): { pair: ContrastPair; role: PairRole }[] {
	return CONTRAST_PAIRS.flatMap(
		(pair): { pair: ContrastPair; role: PairRole }[] => {
			if (pair.ink === token) return [{ pair, role: "ink" }];
			if (pair.surface.includes(token)) return [{ pair, role: "surface" }];
			return [];
		},
	);
}

/** `fail` = required tier not met, `warn` = advisory not met (D3). */
export type ChipStatus = "pass" | "warn" | "fail";

export interface PairVerdict {
	pair: ContrastPair;
	role: PairRole;
	finding: Finding;
	status: ChipStatus;
}

export interface ThemeVerdicts {
	/** What the draft paints: explicit tokens plus every derived one. */
	resolved: Record<string, string>;
	requiredFailures: number;
	advisoryFailures: number;
	/** Per colour token, the chips of every pair it takes part in. */
	byToken: Record<string, PairVerdict[]>;
}

/** Lints the draft as CI does and groups the findings by field. */
export function verdictsFor(draft: ThemeFile): ThemeVerdicts {
	const resolved = resolveTheme(draft);
	const findings = lintTheme(resolved);
	const byPair = new Map(findings.map((f) => [f.pairId, f]));
	let requiredFailures = 0;
	let advisoryFailures = 0;
	for (const f of findings) {
		if (f.pass) continue;
		if (f.tier === "required") requiredFailures++;
		else advisoryFailures++;
	}
	const byToken: Record<string, PairVerdict[]> = {};
	for (const field of FIELD_BY_TOKEN.values()) {
		const verdicts = pairsForToken(field.token).flatMap(({ pair, role }) => {
			const finding = byPair.get(pair.id);
			if (!finding) return [];
			const status: ChipStatus = finding.pass
				? "pass"
				: pair.tier === "required"
					? "fail"
					: "warn";
			return [{ pair, role, finding, status }];
		});
		if (verdicts.length > 0) byToken[field.token] = verdicts;
	}
	return { resolved, requiredFailures, advisoryFailures, byToken };
}

/** The value the file sets for a field, or undefined when it is derived. */
export function explicitValue(
	draft: ThemeFile,
	field: EditorField,
): string | undefined {
	return (draft[field.section] as Record<string, string> | undefined)?.[
		field.key
	];
}

/** The schema grammar for the field's section (themeSchema.ts). */
export function isValidFieldValue(field: EditorField, value: string): boolean {
	switch (field.section) {
		case "colors":
			return COLOR_VALUE_PATTERN.test(value);
		case "shape":
			return PX_VALUE_PATTERN.test(value);
		case "fonts":
			return FONT_STACK_PATTERN.test(value) && isSafeCssValue(value);
		case "shadows":
			return SHADOW_VALUE_PATTERN.test(value) && isSafeCssValue(value);
	}
}

const HEX6 = /^#[0-9a-f]{6}$/i;

/**
 * The draft with one field changed. `null` resets an optional field to its
 * derived value (the key leaves the file). An invalid value, a reset of a
 * required field, an unknown token or a no-op edit returns the same draft
 * object, so callers can compare by identity.
 */
export function applyFieldChange(
	draft: ThemeFile,
	token: string,
	value: string | null,
): ThemeFile {
	const field = fieldByToken(token);
	if (!field) return draft;
	const section = draft[field.section] as Record<string, string> | undefined;
	if (value === null) {
		if (field.required || !section || !(field.key in section)) return draft;
		const { [field.key]: _removed, ...rest } = section;
		const next: ThemeFile = { ...draft };
		if (Object.keys(rest).length > 0) {
			next[field.section] = rest as ThemeFile["colors"];
		} else if (field.section === "colors") {
			next.colors = {};
		} else {
			delete next[field.section];
		}
		return next;
	}
	const trimmed = value.trim();
	const normalized = HEX6.test(trimmed) ? trimmed.toLowerCase() : trimmed;
	if (!isValidFieldValue(field, normalized)) return draft;
	if (section?.[field.key] === normalized) return draft;
	return {
		...draft,
		[field.section]: { ...section, [field.key]: normalized },
	};
}

/**
 * A theme id for a display name — the one rule Bun's duplicate uses too
 * (shared/themeSchema.ts), so an offline copy is named as the file would be.
 */
export const slugify = slugifyThemeId;
