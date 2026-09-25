import { parseArgs } from "node:util";

export interface CaptureRequest {
	scenes: string[];
	themes: string[];
	collage: boolean;
}

export interface CaptureCatalog {
	themeIds: readonly string[];
	sceneIds: readonly string[];
}

const COLLAGE_THEMES = "dark,light,amber,moss";

/** A comma list, or `all`, checked against `known`; deduped, order kept. */
function pickIds(
	value: string,
	known: readonly string[],
	axis: string,
): string[] {
	if (value === "all") return [...known];
	const ids = [...new Set(value.split(",").map((id) => id.trim()))];
	for (const id of ids) {
		if (!known.includes(id)) {
			throw new Error(
				`Unknown ${axis} '${id}'. Choose: ${known.join(", ")}, all`,
			);
		}
	}
	return ids;
}

/** Parse `bun run screenshots` flags. Throws on an unknown scene, theme or option. */
export function parseCaptureArgs(
	argv: string[],
	opts: CaptureCatalog,
): CaptureRequest {
	const { values } = parseArgs({
		args: argv,
		options: {
			scene: { type: "string" },
			theme: { type: "string" },
			collage: { type: "boolean", default: false },
		},
	});
	const collage = values.collage === true;
	const themes = pickIds(
		values.theme ?? (collage ? COLLAGE_THEMES : "dark"),
		opts.themeIds,
		"theme",
	);
	if (collage && themes.length < 2) {
		throw new Error(
			"A collage needs at least two themes; pass a comma-separated --theme list.",
		);
	}
	const scenes = pickIds(
		values.scene ?? opts.sceneIds[0],
		opts.sceneIds,
		"scene",
	);
	return { scenes, themes, collage };
}

export function formatHelp(opts: CaptureCatalog): string {
	return (
		"Usage: bun run screenshots [--scene ID[,ID...]] [--theme ID[,ID...]] [--collage]\n" +
		`Scenes: ${opts.sceneIds.join(", ")}, all\n` +
		`Themes: ${opts.themeIds.join(", ")}, all\n` +
		`Default: ${opts.sceneIds[0]} in dark; --collage defaults to ${COLLAGE_THEMES}\n` +
		"and composes the first requested scene across the requested themes.\n"
	);
}
