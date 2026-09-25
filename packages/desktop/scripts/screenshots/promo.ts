import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import pkg from "../../package.json" with { type: "json" };
import type { PromoCopy } from "./copy";

/** The promo compositions: exact delivery size in CSS px; the master is 2x. */
export const PROMO_FORMATS = [
	{
		id: "readme-hero",
		width: 1600,
		height: 900,
		purpose: "README header image",
	},
	{
		id: "social-card",
		width: 1200,
		height: 630,
		purpose: "Link preview (Open Graph, X, LinkedIn)",
	},
	{
		id: "square-feature",
		width: 1080,
		height: 1080,
		purpose: "Square feed post",
	},
	{
		id: "release-card",
		width: 1200,
		height: 630,
		purpose: "Release announcement card",
	},
] as const;

export type PromoFormat = (typeof PROMO_FORMATS)[number];
export type FormatId = PromoFormat["id"];
export const FORMAT_IDS: readonly FormatId[] = PROMO_FORMATS.map(
	(format) => format.id,
);

/** Class names the template renders and the spec inspects. */
export const PROMO_CLASS = {
	copy: "copy",
	headline: "headline",
	subline: "subline",
	highlight: "highlight",
	version: "version",
	capture: "capture",
} as const;

export const LOGO_PATH = resolve(
	__dirname,
	"../../src/mainview/assets/raven-logo.svg",
);

/** The app version, from its single source: packages/desktop/package.json. */
export function releaseVersion(): string {
	return pkg.version;
}

export interface PromoInput {
	format: PromoFormat;
	image: Buffer;
	/** Object-position percentages of the focal card; null = centre. */
	focal: { x: number; y: number } | null;
	copy: PromoCopy;
	version: string;
	logoSvg: string;
}

const escapeHtml = (text: string) =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const C = PROMO_CLASS;

const STYLE = `
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; }
body { display: grid; overflow: hidden; background: #0b0e13; color: #eef2f7;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
.${C.copy} { display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; }
.brand { display: flex; align-items: center; gap: 12px; color: #9fb3c8; font-size: 18px;
  font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
.brand img { width: 44px; height: auto; }
.${C.headline} { font-weight: 700; line-height: 1.2; letter-spacing: -0.01em;
  padding-bottom: 0.12em; }
.${C.subline} { color: #a7b4c6; line-height: 1.4; }
.highlights { list-style: none; padding: 0; display: grid; gap: 10px; }
.${C.highlight} { position: relative; padding-left: 22px; color: #d5dde8; font-size: 19px; line-height: 1.35; }
.${C.highlight}::before { content: ""; position: absolute; left: 0; top: 0.5em; width: 9px; height: 9px;
  border-radius: 50%; background: #83b8ff; }
.${C.version} { color: #83b8ff; font-size: 64px; font-weight: 700; line-height: 1;
  font-variant-numeric: tabular-nums; }
.shot { min-width: 0; min-height: 0; overflow: hidden; border: 1px solid #2a3340;
  background: #151a21; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5); }
.${C.capture} { display: block; width: 100%; height: 100%; object-fit: cover; }

[data-format="readme-hero"] { grid-template-rows: auto 1fr; gap: 36px; padding: 48px 72px 0; }
[data-format="readme-hero"] .${C.headline} { font-size: 54px; }
[data-format="readme-hero"] .${C.subline} { font-size: 24px; }
[data-format="readme-hero"] .shot { border-bottom: 0; border-radius: 16px 16px 0 0; }

[data-format="square-feature"] { grid-template-rows: auto 1fr; gap: 36px; padding: 56px 56px 0; }
[data-format="square-feature"] .${C.headline} { font-size: 56px; }
[data-format="square-feature"] .${C.subline} { font-size: 26px; }
[data-format="square-feature"] .shot { border-bottom: 0; border-radius: 16px 16px 0 0; }

[data-format="social-card"], [data-format="release-card"] {
  grid-template-columns: 420px 1fr; gap: 48px; padding: 48px 0 48px 56px; }
[data-format="social-card"] .${C.headline} { font-size: 44px; }
[data-format="social-card"] .${C.subline} { font-size: 21px; }
[data-format="release-card"] .${C.headline} { font-size: 30px; }
[data-format="release-card"] .${C.subline} { font-size: 19px; }
[data-format="social-card"] .brand, [data-format="release-card"] .brand { margin-bottom: auto; }
[data-format="social-card"] .${C.copy} > :last-child,
[data-format="release-card"] .${C.copy} > :last-child { margin-bottom: auto; }
[data-format="social-card"] .shot, [data-format="release-card"] .shot {
  border-right: 0; border-radius: 16px 0 0 16px; }
`;

const dataUri = (mime: string, bytes: Buffer | string) =>
	`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

function highlightsHtml(highlights: readonly string[] | undefined): string {
	if (!highlights?.length) return "";
	const items = highlights
		.slice(0, 3)
		.map((text) => `<li class="${C.highlight}">${escapeHtml(text)}</li>`);
	return `<ul class="highlights">${items.join("")}</ul>`;
}

function promoHtml(input: PromoInput): string {
	const { format, copy, focal } = input;
	const position = focal ? `${focal.x}% ${focal.y}%` : "50% 50%";
	const version =
		format.id === "release-card"
			? `<div class="${C.version}">v${escapeHtml(input.version)}</div>`
			: "";
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>${STYLE}</style></head>
<body data-format="${format.id}">
  <section class="${C.copy}">
    <div class="brand"><img alt="" src="${dataUri("image/svg+xml", input.logoSvg)}">RoadRaven</div>
    ${version}
    <h1 class="${C.headline}">${escapeHtml(copy.headline)}</h1>
    <p class="${C.subline}">${escapeHtml(copy.subline)}</p>
    ${highlightsHtml(copy.highlights)}
  </section>
  <figure class="shot"><img class="${C.capture}" alt="RoadRaven roadmap"
    style="object-position: ${position}" src="${dataUri("image/png", input.image)}"></figure>
</body></html>`;
}

/**
 * Render one format twice in fresh browser contexts: at 1x to `delivery` and
 * at 2x to `master`. `inspect` runs on each page after images and fonts load,
 * before the screenshot.
 */
export async function renderPromo(
	browser: Browser,
	input: PromoInput,
	outPaths: { delivery: string; master: string },
	inspect?: (page: Page) => Promise<void>,
): Promise<void> {
	const html = promoHtml(input);
	const { width, height } = input.format;
	const renders = [
		[1, outPaths.delivery],
		[2, outPaths.master],
	] as const;
	for (const [deviceScaleFactor, path] of renders) {
		const context = await browser.newContext({
			viewport: { width, height },
			deviceScaleFactor,
			reducedMotion: "reduce",
		});
		try {
			const page = await context.newPage();
			await page.setContent(html);
			await page.evaluate(async () => {
				await Promise.all([...document.images].map((img) => img.decode()));
				await document.fonts.ready;
			});
			await inspect?.(page);
			await mkdir(dirname(path), { recursive: true });
			await page.screenshot({ path, animations: "disabled", scale: "device" });
		} finally {
			await context.close();
		}
	}
}
