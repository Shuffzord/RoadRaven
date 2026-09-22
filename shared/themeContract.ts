/**
 * Theme token contract (v0.8.3, D2/D3).
 *
 * One registry shared by the static linter (CI + `bun run theme:lint`), the
 * rendered sampler and, later, the in-app theme editor — so none of them can
 * disagree about which ink is allowed on which surface.
 *
 * - `THEME_TOKENS` lists every `--rv-*` token a theme block may set. Twelve
 *   colour tokens are `required`; the rest are `optional` (derived from the
 *   required ones once themes become data, Phase 3). Non-colour tokens are
 *   listed so a theme file can be validated, but the linter skips them.
 * - `CONTRAST_PAIRS` is the ink-on-surface registry. `surface` is composited
 *   bottom -> top (a translucent badge fill over an opaque card), `min` is
 *   the WCAG 2.x ratio, and `evidence` points at the component or rule that
 *   actually paints that ink on that surface. Do not add a pair without one.
 */

export type ThemeToken =
	| { name: string; kind: "color"; tier: "required" | "optional" }
	| { name: string; kind: "non-color" };

export interface ContrastPair {
	id: string;
	label: string;
	/** Token whose colour is measured as the foreground (text, stroke, fill). */
	ink: string;
	/** Surface tokens, bottom to top; layers above the first may be translucent. */
	surface: string[];
	/** Minimum WCAG 2.x contrast ratio: 4.5 text, 3 non-text, 2 visibility floor. */
	min: number;
	/** `required` fails the gate; `advisory` is reported only. */
	tier: "required" | "advisory";
	/** `file:line` of the usage that puts this ink on this surface. */
	evidence: string;
}

const required = (name: string): ThemeToken => ({
	name,
	kind: "color",
	tier: "required",
});
const optional = (name: string): ThemeToken => ({
	name,
	kind: "color",
	tier: "optional",
});
const nonColor = (name: string): ThemeToken => ({ name, kind: "non-color" });

export const THEME_TOKENS: readonly ThemeToken[] = [
	// Background surfaces
	required("--rv-bg-base"),
	required("--rv-bg-canvas"),
	required("--rv-bg-node"),
	optional("--rv-bg-surface"),
	optional("--rv-bg-input"),
	optional("--rv-bg-statusbar"),
	optional("--rv-bg-elevated"),
	optional("--rv-bg-hover"),
	optional("--rv-bg-active"),
	optional("--rv-bg-node-hover"),
	optional("--rv-bg-toolbar"),
	optional("--rv-bg-panel"),
	optional("--rv-bg-config"),
	// Text
	required("--rv-text-primary"),
	required("--rv-text-secondary"),
	optional("--rv-text-tertiary"),
	optional("--rv-text-on-accent"),
	// Borders
	required("--rv-border"),
	optional("--rv-border-subtle"),
	required("--rv-border-focus"),
	nonColor("--rv-border-width"),
	// Accent
	required("--rv-accent"),
	optional("--rv-accent-hover"),
	optional("--rv-accent-muted"),
	optional("--rv-accent-border"),
	// Canvas visuals
	optional("--rv-dot-grid"),
	optional("--rv-line-connector"),
	// Shadows
	nonColor("--rv-shadow-node"),
	nonColor("--rv-shadow-node-hover"),
	nonColor("--rv-shadow-panel"),
	nonColor("--rv-shadow-config"),
	// Scrollbar
	optional("--rv-scrollbar-track"),
	optional("--rv-scrollbar-thumb"),
	// Status (ink + badge fill per status)
	required("--rv-status-not-started"),
	optional("--rv-status-not-started-bg"),
	required("--rv-status-in-progress"),
	optional("--rv-status-in-progress-bg"),
	required("--rv-status-completed"),
	optional("--rv-status-completed-bg"),
	required("--rv-status-blocked"),
	optional("--rv-status-blocked-bg"),
	// Live event pulse and search highlight rings
	optional("--rv-pulse"),
	optional("--rv-search"),
	// Plugin attribution glyph fills (dark block only; cascade to all themes)
	optional("--rv-plugin-claude-code-bg"),
	optional("--rv-plugin-github-actions-bg"),
	optional("--rv-plugin-default-bg"),
	// Shape and type knobs
	nonColor("--rv-radius-xs"),
	nonColor("--rv-radius-sm"),
	nonColor("--rv-radius-md"),
	nonColor("--rv-radius-lg"),
	nonColor("--rv-radius-xl"),
	nonColor("--rv-radius-pill"),
	nonColor("--rv-font-sans"),
];

const TEXT = 4.5;
const NON_TEXT = 3;

const STATUSES = [
	"not-started",
	"in-progress",
	"completed",
	"blocked",
] as const;

const statusPairs: ContrastPair[] = STATUSES.flatMap((s) => [
	{
		id: `badge-${s}`,
		label: `${s} badge text on its fill over the card`,
		ink: `--rv-status-${s}`,
		surface: ["--rv-bg-node", `--rv-status-${s}-bg`],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/RoadmapNode.tsx:346",
	},
	{
		id: `stripe-${s}`,
		label: `${s} status stripe and badge dot vs card`,
		ink: `--rv-status-${s}`,
		surface: ["--rv-bg-node"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/index.css:736",
	},
]);

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
	// --- Text on its surface (WCAG 1.4.3, 4.5:1) ---
	{
		id: "node-title",
		label: "node title on card",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-node"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/RoadmapNode.tsx:339",
	},
	{
		id: "node-title-hover",
		label: "node title on hovered card",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-node-hover"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/RoadmapNode.tsx:235",
	},
	{
		id: "text-primary-on-base",
		label: "body text on app background",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-base"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/index.css:774",
	},
	{
		id: "text-primary-on-surface",
		label: "welcome heading on surface card",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-surface"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/WelcomeScreen.tsx:74",
	},
	{
		id: "text-primary-on-panel",
		label: "side panel title",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-panel"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/SidePanel.tsx:245",
	},
	{
		id: "text-primary-on-elevated",
		label: "menu item text",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-elevated"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/menuStyles.ts:7",
	},
	{
		id: "text-primary-on-input",
		label: "input text",
		ink: "--rv-text-primary",
		surface: ["--rv-bg-input"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/SidePanel.tsx:334",
	},
	{
		id: "text-secondary-on-surface",
		label: "sidebar row text",
		ink: "--rv-text-secondary",
		surface: ["--rv-bg-surface"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/Sidebar.tsx:242",
	},
	{
		id: "text-secondary-on-panel",
		label: "event log drawer text",
		ink: "--rv-text-secondary",
		surface: ["--rv-bg-panel"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/EventLogDrawer.tsx:43",
	},
	{
		id: "text-secondary-on-elevated",
		label: "dialog description text",
		ink: "--rv-text-secondary",
		surface: ["--rv-bg-elevated"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/dialogStyles.ts:31",
	},
	{
		id: "text-secondary-on-toolbar",
		label: "document chip in top bar",
		ink: "--rv-text-secondary",
		surface: ["--rv-bg-toolbar"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/DocumentChip.tsx:39",
	},
	{
		id: "text-tertiary-on-surface",
		label: "sidebar section heading",
		ink: "--rv-text-tertiary",
		surface: ["--rv-bg-surface"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/Sidebar.tsx:81",
	},
	{
		id: "text-tertiary-on-panel",
		label: "event log drawer hint",
		ink: "--rv-text-tertiary",
		surface: ["--rv-bg-panel"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/EventLogDrawer.tsx:53",
	},
	{
		id: "text-tertiary-on-elevated",
		label: "menu shortcut hint",
		ink: "--rv-text-tertiary",
		surface: ["--rv-bg-elevated"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/menuStyles.ts:10",
	},
	{
		id: "text-tertiary-on-input",
		label: "search placeholder",
		ink: "--rv-text-tertiary",
		surface: ["--rv-bg-input"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/TopBar.tsx:289",
	},
	{
		id: "text-tertiary-on-statusbar",
		label: "status bar text",
		ink: "--rv-text-tertiary",
		surface: ["--rv-bg-statusbar"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/StatusBar.tsx:12",
	},
	{
		id: "text-on-accent",
		label: "primary button label",
		ink: "--rv-text-on-accent",
		surface: ["--rv-accent"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/WelcomeScreen.tsx:86",
	},
	{
		id: "accent-text-on-elevated",
		label: "inline code / active menu item",
		ink: "--rv-accent",
		surface: ["--rv-bg-elevated"],
		min: TEXT,
		tier: "required",
		evidence:
			"packages/desktop/src/mainview/components/MarkdownRenderer.tsx:70",
	},
	{
		id: "accent-text-on-panel",
		label: "markdown link in side panel",
		ink: "--rv-accent",
		surface: ["--rv-bg-panel"],
		min: TEXT,
		tier: "required",
		evidence:
			"packages/desktop/src/mainview/components/MarkdownRenderer.tsx:47",
	},
	{
		id: "accent-text-on-accent-muted",
		label: "type chip in side panel",
		ink: "--rv-accent",
		surface: ["--rv-bg-panel", "--rv-accent-muted"],
		min: TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/SidePanel.tsx:402",
	},
	...statusPairs,

	// --- Non-text UI (WCAG 1.4.11, 3:1) ---
	{
		id: "selection-outline-vs-node",
		label: "selection outline inside card edge",
		ink: "--rv-accent",
		surface: ["--rv-bg-node"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/RoadmapNode.tsx:235",
	},
	{
		id: "focus-outline-vs-canvas",
		label: "keyboard focus ring outside card",
		ink: "--rv-accent",
		surface: ["--rv-bg-canvas"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/index.css:786",
	},
	{
		id: "search-outline-vs-canvas",
		label: "search match outline",
		ink: "--rv-search",
		surface: ["--rv-bg-canvas"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/index.css:844",
	},
	{
		id: "pulse-ring-vs-canvas",
		label: "live event pulse ring",
		ink: "--rv-pulse",
		surface: ["--rv-bg-canvas"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/index.css:805",
	},
	{
		id: "focus-border-vs-input",
		label: "focused input border vs input fill",
		ink: "--rv-border-focus",
		surface: ["--rv-bg-input"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/SidePanel.tsx:334",
	},
	{
		id: "focus-border-vs-panel",
		label: "focused input border vs panel",
		ink: "--rv-border-focus",
		surface: ["--rv-bg-panel"],
		min: NON_TEXT,
		tier: "required",
		evidence: "packages/desktop/src/mainview/components/SidePanel.tsx:222",
	},
	{
		id: "connector-floor",
		label: "tree connector visibility floor",
		ink: "--rv-line-connector",
		surface: ["--rv-bg-canvas"],
		min: 2,
		tier: "required",
		evidence: "packages/desktop/src/mainview/index.css:721",
	},

	// --- Advisory (design taste; reported, never gated) ---
	{
		id: "connector",
		label: "tree connector",
		ink: "--rv-line-connector",
		surface: ["--rv-bg-canvas"],
		min: NON_TEXT,
		tier: "advisory",
		evidence: "packages/desktop/src/mainview/index.css:721",
	},
	{
		id: "border-vs-node",
		label: "card edge",
		ink: "--rv-border",
		surface: ["--rv-bg-node"],
		min: NON_TEXT,
		tier: "advisory",
		evidence: "packages/desktop/src/mainview/components/RoadmapNode.tsx:235",
	},
	{
		id: "border-vs-panel",
		label: "side panel edge",
		ink: "--rv-border",
		surface: ["--rv-bg-panel"],
		min: NON_TEXT,
		tier: "advisory",
		evidence: "packages/desktop/src/mainview/components/SidePanel.tsx:222",
	},
	{
		id: "border-vs-toolbar",
		label: "top bar edge",
		ink: "--rv-border",
		surface: ["--rv-bg-toolbar"],
		min: NON_TEXT,
		tier: "advisory",
		evidence: "packages/desktop/src/mainview/components/TopBar.tsx:36",
	},
	{
		id: "card-vs-canvas",
		label: "card vs canvas",
		ink: "--rv-bg-node",
		surface: ["--rv-bg-canvas"],
		min: NON_TEXT,
		tier: "advisory",
		evidence: "packages/desktop/src/mainview/components/Canvas.tsx:320",
	},
];
