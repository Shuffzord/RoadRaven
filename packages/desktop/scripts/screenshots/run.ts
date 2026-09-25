import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { THEME_IDS } from "../../src/mainview/themes";

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		theme: { type: "string" },
		collage: { type: "boolean", default: false },
		help: { type: "boolean", default: false },
	},
});

if (values.help) {
	process.stdout.write(
		`Usage: bun run screenshots:cfa [--theme ID[,ID...]] [--collage]\n` +
			`Themes: ${THEME_IDS.join(", ")}, all\n` +
			`Default: dark; --collage defaults to dark,light,amber,moss.\n`,
	);
	process.exit(0);
}

const requested =
	values.theme ?? (values.collage ? "dark,light,amber,moss" : "dark");
const themes =
	requested === "all"
		? [...THEME_IDS]
		: [...new Set(requested.split(",").map((id) => id.trim()))];
for (const id of themes) {
	if (!THEME_IDS.includes(id)) {
		throw new Error(`Unknown theme '${id}'. Choose: ${THEME_IDS.join(", ")}`);
	}
}
if (values.collage && themes.length < 2) {
	throw new Error(
		"A collage needs at least two themes; pass a comma-separated --theme list.",
	);
}

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
			ROADRAVEN_CAPTURE_THEMES: themes.join(","),
			ROADRAVEN_CAPTURE_COLLAGE: values.collage ? "1" : "0",
		},
		stdout: "inherit",
		stderr: "inherit",
	},
);
process.exit(await child.exited);
