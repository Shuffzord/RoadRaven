import { resolve } from "node:path";
import { THEME_IDS } from "../../src/mainview/themes";
import { formatHelp, parseCaptureArgs } from "./cli";
import { SCENE_IDS } from "./scenes";

const argv = Bun.argv.slice(2);
const catalog = { themeIds: THEME_IDS, sceneIds: SCENE_IDS };

if (argv.includes("--help")) {
	process.stdout.write(formatHelp(catalog));
	process.exit(0);
}

const request = parseCaptureArgs(argv, catalog);

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
		},
		stdout: "inherit",
		stderr: "inherit",
	},
);
process.exit(await child.exited);
