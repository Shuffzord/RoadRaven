import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildGallery,
	type GalleryCatalog,
	type RunInfo,
} from "../../../scripts/screenshots/gallery";
import { QUALITY_IDS } from "../../../scripts/screenshots/quality";

/** A minimal 33-byte PNG: signature + IHDR (length, type, width, height, ...). */
function buildPngHeader(width: number, height: number): Uint8Array {
	const buf = new Uint8Array(33);
	const view = new DataView(buf.buffer);
	buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
	view.setUint32(8, 13); // IHDR chunk length
	buf.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
	view.setUint32(16, width);
	view.setUint32(20, height);
	buf[24] = 8; // bit depth
	buf[25] = 6; // color type
	return buf;
}

const catalog: GalleryCatalog = {
	qualityIds: QUALITY_IDS,
	sceneIds: ["cfa-overview", "project-overview"],
	themeIds: ["dark", "light"],
	sceneTitles: {
		"cfa-overview": "CFA Level I",
		"project-overview": "Ship v1.0",
	},
	themeNames: { dark: "Dark", light: "Light" },
};

const RUN_INFO: RunInfo = {
	sha: "abc1234",
	browser: "Chromium 128.0",
	capturedAt: "2026-09-25T00:00:00.000Z",
	scenes: ["cfa-overview"],
	themes: ["dark"],
};

async function writePng(
	showcaseDir: string,
	quality: string,
	scene: string,
	theme: string,
	width: number,
	height: number,
): Promise<void> {
	const sceneDir = join(showcaseDir, "captures", quality, scene);
	await mkdir(sceneDir, { recursive: true });
	await writeFile(
		join(sceneDir, `${theme}.png`),
		buildPngHeader(width, height),
	);
}

let dir = "";

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true });
	dir = "";
});

describe("buildGallery", () => {
	it("builds a manifest and index.html from what is on disk", async () => {
		dir = await mkdtemp(join(tmpdir(), "showcase-gallery-"));
		await writePng(dir, "preview", "cfa-overview", "dark", 1600, 1200);
		await writePng(dir, "standard", "cfa-overview", "dark", 3200, 2400);
		await mkdir(join(dir, "captures", "standard"), { recursive: true });
		await writeFile(
			join(dir, "captures", "standard", "run.json"),
			`${JSON.stringify(RUN_INFO, null, 2)}\n`,
		);

		const manifest = await buildGallery(dir, catalog);

		expect(manifest.cells).toHaveLength(2);
		expect(manifest.cells).toEqual(
			expect.arrayContaining([
				{
					quality: "preview",
					scene: "cfa-overview",
					theme: "dark",
					path: "captures/preview/cfa-overview/dark.png",
					width: 1600,
					height: 1200,
					bytes: 33,
				},
				{
					quality: "standard",
					scene: "cfa-overview",
					theme: "dark",
					path: "captures/standard/cfa-overview/dark.png",
					width: 3200,
					height: 2400,
					bytes: 33,
				},
			]),
		);

		const expectedMissing: Array<{
			quality: string;
			scene: string;
			theme: string;
		}> = [];
		for (const quality of catalog.qualityIds) {
			for (const scene of catalog.sceneIds) {
				for (const theme of catalog.themeIds) {
					const captured =
						(quality === "preview" || quality === "standard") &&
						scene === "cfa-overview" &&
						theme === "dark";
					if (!captured) expectedMissing.push({ quality, scene, theme });
				}
			}
		}
		expect(manifest.missing).toEqual(expectedMissing);

		const html = await readFile(join(dir, "index.html"), "utf8");
		expect(html).toContain('src="captures/preview/cfa-overview/dark.png"');
		expect(html).toContain('src="captures/standard/cfa-overview/dark.png"');
		expect(html).not.toContain("data:");
		expect(html).not.toMatch(/[A-Za-z]:\\/);
		expect(html).not.toContain("file://");
		expect(html).not.toContain("http://");
		expect(html).not.toContain("https://");
		const notCapturedCount = html.split("not captured").length - 1;
		expect(notCapturedCount).toBe(expectedMissing.length);
		expect(html).toContain(RUN_INFO.sha);
		expect(html).toContain(RUN_INFO.browser);
		expect(html).toContain(RUN_INFO.capturedAt);

		expect(Object.keys(manifest.runs)).toEqual(["standard"]);
		expect(manifest.runs.standard).toEqual(RUN_INFO);
	});

	it("an empty showcase dir yields zero cells, all triples missing, no throw", async () => {
		dir = await mkdtemp(join(tmpdir(), "showcase-gallery-empty-"));
		const manifest = await buildGallery(dir, catalog);
		expect(manifest.cells).toHaveLength(0);
		expect(manifest.missing).toHaveLength(
			catalog.qualityIds.length *
				catalog.sceneIds.length *
				catalog.themeIds.length,
		);
		expect(manifest.runs).toEqual({});
	});
});
