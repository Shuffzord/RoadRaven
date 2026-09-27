import { open, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pngDimensions } from "./quality";

/** Written by `showcase.spec.ts` into `captures/<quality>/run.json`. */
export interface RunInfo {
	sha: string;
	browser: string;
	capturedAt: string;
	scenes: string[];
	themes: string[];
}

export interface GalleryCatalog {
	qualityIds: readonly string[];
	sceneIds: readonly string[];
	themeIds: readonly string[];
	sceneTitles: Record<string, string>;
	themeNames: Record<string, string>;
}

export interface GalleryCell {
	quality: string;
	scene: string;
	theme: string;
	/** Relative to `showcaseDir`, forward-slash, no scheme. */
	path: string;
	width: number;
	height: number;
	bytes: number;
}

export interface MissingCell {
	quality: string;
	scene: string;
	theme: string;
}

export interface GalleryManifest {
	generatedAt: string;
	/** Keyed by quality; a quality with no `captures/<quality>/run.json` is absent. */
	runs: Record<string, RunInfo>;
	cells: GalleryCell[];
	missing: MissingCell[];
}

const THUMB_WIDTH = 260;

/** File size + PNG header dims, reading only the first 33 bytes; `undefined` when missing. */
async function readCell(
	absPath: string,
): Promise<{ width: number; height: number; bytes: number } | undefined> {
	let bytes: number;
	try {
		bytes = (await stat(absPath)).size;
	} catch {
		return undefined;
	}
	const handle = await open(absPath, "r");
	try {
		const header = Buffer.alloc(33);
		await handle.read(header, 0, 33, 0);
		return { ...pngDimensions(header), bytes };
	} finally {
		await handle.close();
	}
}

/** `captures/<quality>/run.json`, best-effort; `undefined` when missing or unparsable. */
async function readRunInfo(
	showcaseDir: string,
	quality: string,
): Promise<RunInfo | undefined> {
	try {
		const raw = await readFile(
			join(showcaseDir, "captures", quality, "run.json"),
			"utf8",
		);
		return JSON.parse(raw) as RunInfo;
	} catch {
		return undefined;
	}
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function cellHtml(cell: GalleryCell | undefined): string {
	if (!cell) return '<div class="missing">not captured</div>';
	const src = escapeHtml(cell.path);
	return `<a href="${src}"><img class="thumb" src="${src}" loading="lazy" width="${THUMB_WIDTH}" alt=""></a>`;
}

function runHeader(run: RunInfo | undefined): string {
	if (!run) return "";
	return `<p class="run">${escapeHtml(run.sha)} · ${escapeHtml(run.browser)} · ${escapeHtml(run.capturedAt)}</p>`;
}

function qualitySection(
	quality: string,
	catalog: GalleryCatalog,
	cellsByKey: Map<string, GalleryCell>,
	run: RunInfo | undefined,
): string {
	const head = catalog.themeIds
		.map(
			(theme) =>
				`<th scope="col">${escapeHtml(catalog.themeNames[theme] ?? theme)}</th>`,
		)
		.join("");
	const rows = catalog.sceneIds
		.map((scene) => {
			const cols = catalog.themeIds
				.map(
					(theme) =>
						`<td>${cellHtml(cellsByKey.get(`${quality}|${scene}|${theme}`))}</td>`,
				)
				.join("");
			const title = escapeHtml(catalog.sceneTitles[scene] ?? scene);
			return `<tr><th scope="row">${title}</th>${cols}</tr>`;
		})
		.join("");
	return `<section><h2>${escapeHtml(quality)}</h2>${runHeader(run)}<table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></section>`;
}

function buildHtml(
	catalog: GalleryCatalog,
	cells: GalleryCell[],
	runs: Record<string, RunInfo>,
): string {
	const cellsByKey = new Map(
		cells.map((cell) => [`${cell.quality}|${cell.scene}|${cell.theme}`, cell]),
	);
	const sections = catalog.qualityIds
		.map((quality) =>
			qualitySection(quality, catalog, cellsByKey, runs[quality]),
		)
		.join("\n");
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>RoadRaven showcase</title>
<style>
  body { font-family: system-ui, sans-serif; background: #101318; color: #edf1f7; margin: 24px; }
  h1 { font-size: 22px; }
  h2 { text-transform: capitalize; font-size: 18px; margin-top: 32px; }
  .run { color: #a7b4c6; font-size: 13px; margin: 2px 0 12px; }
  table { border-collapse: collapse; margin-bottom: 32px; }
  th, td { border: 1px solid #35404f; padding: 8px; text-align: left; vertical-align: top; }
  .thumb { width: ${THUMB_WIDTH}px; height: auto; display: block; }
  .missing { width: ${THUMB_WIDTH}px; min-height: 60px; color: #a7b4c6; font-style: italic;
    text-align: center; display: flex; align-items: center; justify-content: center; }
</style></head>
<body>
<h1>RoadRaven showcase</h1>
${sections}
</body></html>
`;
}

/**
 * Scans `captures/<quality>/<scene>/<theme>.png` for every combination in
 * `catalog`, writes `manifest.json` and `index.html` under `showcaseDir`, and
 * returns the manifest. Pure over its inputs: no Playwright, no base64, no
 * reads beyond a PNG's 33-byte header. Each quality's own
 * `captures/<quality>/run.json` (if present) is read off disk into
 * `manifest.runs` and drives that quality's section header in the HTML.
 */
export async function buildGallery(
	showcaseDir: string,
	catalog: GalleryCatalog,
): Promise<GalleryManifest> {
	const cells: GalleryCell[] = [];
	const missing: MissingCell[] = [];
	for (const quality of catalog.qualityIds) {
		for (const scene of catalog.sceneIds) {
			for (const theme of catalog.themeIds) {
				const relPath = `captures/${quality}/${scene}/${theme}.png`;
				const absPath = join(
					showcaseDir,
					"captures",
					quality,
					scene,
					`${theme}.png`,
				);
				const found = await readCell(absPath);
				if (found)
					cells.push({ quality, scene, theme, path: relPath, ...found });
				else missing.push({ quality, scene, theme });
			}
		}
	}
	const runs: Record<string, RunInfo> = {};
	for (const quality of catalog.qualityIds) {
		const run = await readRunInfo(showcaseDir, quality);
		if (run) runs[quality] = run;
	}
	const manifest: GalleryManifest = {
		generatedAt: new Date().toISOString(),
		runs,
		cells,
		missing,
	};
	await writeFile(
		join(showcaseDir, "manifest.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	await writeFile(
		join(showcaseDir, "index.html"),
		buildHtml(catalog, cells, runs),
	);
	return manifest;
}
