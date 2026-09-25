import { resolve } from "node:path";
import { BUILT_IN_THEMES, THEME_IDS } from "../../src/mainview/themes";
import { formatHelp, parseCaptureArgs } from "./cli";
import { buildGallery, type GalleryCatalog } from "./gallery";
import { QUALITY_IDS } from "./quality";
import { SCENE_IDS, SCENES } from "./scenes";

const argv = Bun.argv.slice(2);
const catalog = { themeIds: THEME_IDS, sceneIds: SCENE_IDS };

if (argv.includes("--help")) {
	process.stdout.write(formatHelp(catalog));
	process.exit(0);
}

const request = parseCaptureArgs(argv, catalog);

const SHOWCASE_DIR = resolve(import.meta.dir, "../../../../artifacts/showcase");
const galleryCatalog: GalleryCatalog = {
	qualityIds: QUALITY_IDS,
	sceneIds: SCENE_IDS,
	themeIds: THEME_IDS,
	sceneTitles: Object.fromEntries(
		SCENES.map((scene) => [scene.id, scene.title]),
	),
	themeNames: Object.fromEntries(
		BUILT_IN_THEMES.map((theme) => [theme.id, theme.meta.name]),
	),
};

async function captureWithPlaywright(): Promise<number> {
	const child = Bun.spawn(
		[
			process.execPath,
			"run",
			"test:e2e",
			"--config=scripts/screenshots/playwright.config.ts",
		],
		{
			cwd: resolve(import.meta.dir, "../.."),
			env: {
				...process.env,
				ROADRAVEN_CAPTURE_SCENES: request.scenes.join(","),
				ROADRAVEN_CAPTURE_THEMES: request.themes.join(","),
				ROADRAVEN_CAPTURE_COLLAGE: request.collage ? "1" : "0",
				ROADRAVEN_CAPTURE_QUALITY: request.quality,
				ROADRAVEN_CAPTURE_FORMATS: request.formats.join(","),
			},
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	return await child.exited;
}

const exitCode = request.galleryOnly ? 0 : await captureWithPlaywright();
await buildGallery(SHOWCASE_DIR, galleryCatalog);
process.stdout.write(`Gallery: ${resolve(SHOWCASE_DIR, "index.html")}\n`);
process.exit(exitCode);
