/**
 * Rendered contrast sampler (v0.8.3 Phase 1).
 *
 * The static linter (shared/contrast.ts) scores token values; this scores
 * what the cascade actually painted. `readSampleInPage` runs inside the
 * browser (Playwright `page.evaluate`, or jsdom in the unit test) and only
 * gathers raw computed colours: the ink and every ancestor's
 * `background-color` up to <html>. Everything else — compositing the
 * translucent layers over the first opaque one, the WCAG ratio, the report —
 * is pure Node code reusing the Phase 0 math, so it is unit-testable and can
 * never disagree with `bun run theme:lint`.
 *
 * axe-core gives up on the node cards ("background colour could not be
 * determined because it is overlapped by another element": the ::before
 * stripe and ::after pulse ring). Walking the ancestors ourselves is exactly
 * the step it refuses to take.
 */

import type { Page } from "@playwright/test";
import {
	composite,
	contrastRatio,
	parseColor,
	type RGB,
	type RGBA,
} from "../../../../shared/contrast";
import {
	CONTRAST_PAIRS,
	type ContrastPair,
	STATUS_IDS,
	STATUS_TOKENS,
} from "../../../../shared/themeContract";
import {
	NODE_CARD_ATTR,
	NODE_FOCUSED_ATTR,
	NODE_PROGRESS_ATTR,
	NODE_RIBBON_ATTR,
	NODE_STATUS_ATTR,
	NODE_TYPE_CHIP_ATTR,
	SAVE_STATE_ATTR,
} from "../../src/mainview/lib/domContract";
import { getBuiltInTheme } from "../../src/mainview/themes";

/**
 * Switches the theme the way the user does — the top-bar picker
 * (TopBar.tsx:193, ThemePicker.tsx) — and waits until applyTheme has painted
 * it. Since v0.8.3 Phase 3 the tokens live in JS, so setting `data-theme` on
 * <html> by hand no longer changes a single colour.
 */
export async function selectTheme(page: Page, id: string): Promise<void> {
	const label = getBuiltInTheme(id)?.meta.name;
	if (!label) throw new Error(`${id} is not a built-in theme`);
	await page.getByRole("button", { name: /^Theme:/ }).click();
	await page.getByRole("menuitem", { name: label, exact: true }).click();
	await page.waitForSelector(`html[data-theme="${id}"]`, { timeout: 3000 });
}

/** When in the walkthrough the element exists. */
export type SampleStage = "page" | "menu" | "context-menu" | "focus";

export interface SampleSpec {
	id: string;
	/** Pair in `CONTRAST_PAIRS` that names the ink token, surface tokens, min and tier. */
	pairId: string;
	stage: SampleStage;
	/** CSS selector; the first match is read. A missing match fails the run. */
	selector: string;
	/** When set, the first match whose text starts with this is read instead. */
	text?: string;
	/** Computed property that carries the ink. */
	property: "color" | "background-color" | "outline-color" | "border-top-color";
	/** Read the ink from this pseudo-element of the match instead. */
	pseudo?: "::before" | "::after";
	/**
	 * Where the ink is painted. `behind`: over the element's own background
	 * stack (text, badge fill, the stripe on its card). `around`: outside the
	 * element's box (an outline), so the walk starts at the parent.
	 */
	paint: "behind" | "around";
	/** `file:line` of the usage being sampled. */
	evidence: string;
}

export interface SampleReading {
	id: string;
	/** Computed ink colour; null when the element is missing or nothing is painted. */
	ink: string | null;
	/** `background-color` of the start element and each ancestor, nearest first. */
	layers: string[];
	reason?: string;
}

export interface SampleFinding {
	theme: string;
	sampleId: string;
	pairId: string;
	tier: ContrastPair["tier"];
	min: number;
	ratio: number;
	ink: string;
	surface: string;
	pass: boolean;
	reason?: string;
}

// Node-card selectors mirror tests/a11y/audit.spec.ts: the card carries
// NODE_CARD_ATTR (RoadmapNode.tsx:254) and its inline style carries
// `--node-stripe-color: var(--rv-status-<s>)` (RoadmapNode.tsx:266), which
// is how a card of a given status is picked without retyping badge labels.
export const CARD = `[${NODE_CARD_ATTR}]`;
const cardOf = (status: (typeof STATUS_IDS)[number]) =>
	`${CARD}[style*="var(${STATUS_TOKENS[status].ink})"]`;
const RD = "packages/desktop/src/mainview/components/RoadmapNode.tsx";

const statusSamples: SampleSpec[] = STATUS_IDS.flatMap((s) => [
	{
		id: `badge-${s}`,
		pairId: `badge-${s}`,
		stage: "page",
		selector: `${cardOf(s)} > span.inline-flex`,
		property: "color",
		paint: "behind",
		evidence: `${RD}:367`,
	},
	{
		// The 6px dot inside the badge pill (non-text, but it reads the same
		// badge ink on the same fill, so the text pair is the stricter check).
		// Its own background IS the ink, so the surface walk starts at the pill.
		id: `badge-dot-${s}`,
		pairId: `badge-${s}`,
		stage: "page",
		selector: `${cardOf(s)} > span.inline-flex > span`,
		property: "background-color",
		paint: "around",
		evidence: `${RD}:368`,
	},
	{
		id: `stripe-${s}`,
		pairId: `stripe-${s}`,
		stage: "page",
		selector: cardOf(s),
		property: "background-color",
		pseudo: "::before",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/index.css:758",
	},
]);

// v0.8.4 Phase 1 card visuals: the card is picked by NODE_STATUS_ATTR, the
// element by its own data-* hook (domContract.ts), no class names.
const cardWithStatus = (status: (typeof STATUS_IDS)[number]) =>
	`${CARD}[${NODE_STATUS_ATTR}="${status}"]`;

const cardVisualSamples: SampleSpec[] = [
	...STATUS_IDS.map(
		(s): SampleSpec => ({
			// The band's own background IS the ink; its clip wrapper is
			// transparent, so the surface walk starts there and reaches the card.
			id: `ribbon-${s}`,
			pairId: `ribbon-${s}`,
			stage: "page",
			selector: `${cardWithStatus(s)} [${NODE_RIBBON_ATTR}]`,
			property: "background-color",
			paint: "around",
			evidence: `${RD}:384`,
		}),
	),
	{
		// Hello World's root is in-progress with children, so it carries the
		// `n / m done` line. Card ink (NODE_INK), hence the node-title pair.
		id: "progress-line",
		pairId: "node-title",
		stage: "page",
		selector: `${cardWithStatus("in-progress")} [${NODE_PROGRESS_ATTR}]`,
		property: "color",
		paint: "behind",
		evidence: `${RD}:478`,
	},
	{
		// Every Hello World node carries a type (milestone / task) and the
		// sample has no typeConfig, so each card shows a raw-id chip.
		id: "type-chip",
		pairId: "node-title",
		stage: "page",
		selector: `${CARD} [${NODE_TYPE_CHIP_ATTR}]`,
		property: "color",
		paint: "behind",
		evidence: `${RD}:461`,
	},
];

/**
 * What is read, per theme, on the Hello World sample. The spec walks the
 * stages in order: `page` right after the theme is applied, `menu` with the
 * File menu open, `focus` with the root card selected in keyboard mode.
 */
export const SAMPLES: readonly SampleSpec[] = [
	{
		id: "node-title",
		pairId: "node-title",
		stage: "page",
		selector: `${CARD} > span.block`,
		property: "color",
		paint: "behind",
		evidence: `${RD}:360`,
	},
	...statusSamples,
	...cardVisualSamples,
	{
		// The root of Hello World is in-progress and has children, so it is
		// the one card with a chevron (samples/hello-world.json).
		id: "chevron-text",
		pairId: "badge-in-progress",
		stage: "page",
		selector: `${cardOf("in-progress")} > button`,
		property: "color",
		paint: "behind",
		evidence: `${RD}:388`,
	},
	{
		// The chevron's 1px border reads the same badge ink over the same fill.
		id: "chevron-border",
		pairId: "badge-in-progress",
		stage: "page",
		selector: `${cardOf("in-progress")} > button`,
		property: "border-top-color",
		paint: "behind",
		evidence: `${RD}:387`,
	},
	{
		// Hello World is never saved to disk in this walkthrough, so the chip's
		// save dot is the hollow "untitled" ring (saveDot.ts:12); its border is
		// the ink and its own background is transparent, so the walk starts at
		// the chip. The saved/error dots (status inks) are static-linted only.
		id: "save-dot",
		pairId: "save-dot-untitled-vs-toolbar",
		stage: "page",
		selector: `header [${SAVE_STATE_ATTR}]`,
		property: "border-top-color",
		paint: "around",
		evidence: "packages/desktop/src/mainview/lib/saveDot.ts:12",
	},
	{
		id: "document-chip",
		pairId: "text-secondary-on-toolbar",
		stage: "page",
		selector: `header button:has([${SAVE_STATE_ATTR}])`,
		property: "color",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/components/DocumentChip.tsx:40",
	},
	{
		id: "status-bar-version",
		pairId: "text-tertiary-on-statusbar",
		stage: "page",
		selector: "footer > div:last-child > span:last-of-type",
		property: "color",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/components/StatusBar.tsx:26",
	},
	{
		id: "sidebar-outline-row",
		pairId: "text-secondary-on-surface",
		stage: "page",
		selector: '[data-outline-tree] [role="treeitem"]',
		property: "color",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/components/Outline.tsx:206",
	},
	{
		// The Hello World root row is in-progress; its 7px dot is the second
		// span in the row (chevron slot, dot, title). The dot's own background
		// is the ink, so the surface walk starts at the row.
		id: "outline-dot",
		pairId: "status-in-progress-vs-surface",
		stage: "page",
		selector: '[data-outline-tree] [role="treeitem"] > span:nth-child(2)',
		property: "background-color",
		paint: "around",
		evidence: "packages/desktop/src/mainview/components/Outline.tsx:246",
	},
	{
		id: "context-menu-delete",
		pairId: "status-blocked-text-on-elevated",
		stage: "context-menu",
		selector: '[role="menu"] [role="menuitem"]',
		text: "Delete",
		property: "color",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/components/ContextMenu.tsx:251",
	},
	{
		id: "menu-item",
		pairId: "text-primary-on-elevated",
		stage: "menu",
		selector: '[role="menu"] [role="menuitem"]:not([data-disabled])',
		property: "color",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/components/menuStyles.ts:7",
	},
	{
		id: "menu-hint",
		pairId: "text-tertiary-on-elevated",
		stage: "menu",
		selector:
			'[role="menu"] [role="menuitem"]:not([data-disabled]) > span:nth-child(2)',
		property: "color",
		paint: "behind",
		evidence: "packages/desktop/src/mainview/components/menuStyles.ts:10",
	},
	{
		id: "focus-ring",
		pairId: "focus-outline-vs-canvas",
		stage: "focus",
		selector: `${CARD}[${NODE_FOCUSED_ATTR}="true"]`,
		property: "outline-color",
		paint: "around",
		evidence: "packages/desktop/src/mainview/index.css:807",
	},
	{
		// Advisory: reported in the markdown, never gated.
		id: "card-vs-canvas",
		pairId: "card-vs-canvas",
		stage: "page",
		selector: CARD,
		property: "background-color",
		paint: "around",
		evidence: "packages/desktop/src/mainview/components/Canvas.tsx:320",
	},
];

/**
 * Runs inside the page. Self-contained on purpose: Playwright serialises the
 * function source, so it may reference nothing from this module.
 */
export function readSampleInPage(spec: SampleSpec): SampleReading {
	const el = spec.text
		? [...document.querySelectorAll(spec.selector)].find((e) =>
				(e.textContent ?? "").trim().startsWith(spec.text as string),
			)
		: document.querySelector(spec.selector);
	if (!el) {
		return { id: spec.id, ink: null, layers: [], reason: "element not found" };
	}
	const view = el.ownerDocument.defaultView as Window;
	const own = view.getComputedStyle(el, spec.pseudo ?? null);
	if (
		spec.property === "outline-color" &&
		(own.outlineStyle === "none" || own.outlineWidth === "0px")
	) {
		return { id: spec.id, ink: null, layers: [], reason: "no outline drawn" };
	}
	const ink = own.getPropertyValue(spec.property);
	const layers: string[] = [];
	let node: Element | null = spec.paint === "around" ? el.parentElement : el;
	while (node) {
		layers.push(view.getComputedStyle(node).backgroundColor);
		node = node.parentElement;
	}
	return { id: spec.id, ink, layers };
}

/**
 * Composites the background stack the browser reported (nearest layer
 * first). The first fully opaque layer is the backdrop; the translucent
 * layers between it and the element are painted over it, nearest last.
 * Null when nothing opaque was found.
 */
export function resolveSurface(layers: readonly string[]): RGB | null {
	const above: RGBA[] = [];
	let surface: RGB | null = null;
	for (const layer of layers) {
		const c = parseColor(layer);
		if (!c || c[3] === 0) continue;
		if (c[3] >= 1) {
			surface = [c[0], c[1], c[2]];
			break;
		}
		above.push(c);
	}
	if (!surface) return null;
	for (let i = above.length - 1; i >= 0; i--) {
		surface = composite(above[i], surface);
	}
	return surface;
}

function toHex([r, g, b]: RGB): string {
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Scores one reading against its registered pair. */
export function scoreSample(
	theme: string,
	spec: SampleSpec,
	reading: SampleReading,
): SampleFinding {
	const pair = CONTRAST_PAIRS.find((p) => p.id === spec.pairId);
	if (!pair) throw new Error(`${spec.id}: unknown pair ${spec.pairId}`);
	const base = {
		theme,
		sampleId: spec.id,
		pairId: pair.id,
		tier: pair.tier,
		min: pair.min,
	};
	const unmeasurable = (reason: string): SampleFinding => ({
		...base,
		ratio: 0,
		ink: reading.ink ?? "",
		surface: "",
		pass: false,
		reason,
	});
	if (reading.ink === null) return unmeasurable(reading.reason ?? "no ink");
	const inkLayer = parseColor(reading.ink);
	if (!inkLayer) return unmeasurable(`ink "${reading.ink}" is not a colour`);
	const surface = resolveSurface(reading.layers);
	if (!surface) return unmeasurable("no opaque background behind the element");
	const ink = composite(inkLayer, surface);
	const ratio = contrastRatio(ink, surface);
	return {
		...base,
		ratio,
		ink: toHex(ink),
		surface: toHex(surface),
		pass: ratio >= pair.min,
	};
}

/** Markdown report: every ratio, with the gate verdict per row. */
export function renderReport(
	findings: readonly SampleFinding[],
	baseline: ReadonlySet<string>,
): string {
	const fmt = (f: SampleFinding) =>
		f.reason ? `?? (${f.reason})` : `${f.ratio.toFixed(2)}:1`;
	const status = (f: SampleFinding) => {
		if (f.pass) return "pass";
		if (f.tier === "advisory") return "advisory";
		return baseline.has(`${f.theme}/${f.sampleId}`) ? "known" : "NEW";
	};
	const lines = [
		"# Rendered contrast report",
		"",
		"| theme | sample | pair | tier | ink | surface | ratio | min | status |",
		"|---|---|---|---|---|---|---|---|---|",
		...findings.map(
			(f) =>
				`| ${f.theme} | ${f.sampleId} | ${f.pairId} | ${f.tier} | ${f.ink} | ${f.surface} | ${fmt(f)} | ${f.min} | ${status(f)} |`,
		),
	];
	return `${lines.join("\n")}\n`;
}
