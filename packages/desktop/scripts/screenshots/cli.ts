import { parseArgs } from "node:util";
import { FORMAT_IDS } from "./promo";
import { parsePick } from "./publish";
import {
	DEFAULT_QUALITY,
	QUALITY_IDS,
	QUALITY_PROFILES,
	type QualityId,
} from "./quality";

export interface CaptureRequest {
	scenes: string[];
	themes: string[];
	collage: boolean;
	quality: QualityId;
	galleryOnly: boolean;
	/** Promo format ids to compose from each capture; empty = none. */
	formats: string[];
	/** `--publish` picks, parsed and validated; empty = no publish step. */
	publish: string[];
	/** `--publish` with no explicit `--scene`: skip capture, publish only. */
	publishOnly: boolean;
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

/** A comma list of `--publish` picks; each is validated by `parsePick`, which throws on bad grammar. */
function pickPicks(value: string | undefined): string[] {
	if (value === undefined) return [];
	const picks = value.split(",").map((pick) => pick.trim());
	for (const pick of picks) parsePick(pick);
	return picks;
}

/** A single id checked against `QUALITY_IDS`; `undefined` -> `DEFAULT_QUALITY`. */
function pickQuality(value: string | undefined): QualityId {
	const id = value ?? DEFAULT_QUALITY;
	if (!(QUALITY_IDS as readonly string[]).includes(id)) {
		throw new Error(
			`Unknown quality '${id}'. Choose: ${QUALITY_IDS.join(", ")}`,
		);
	}
	return id as QualityId;
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
			quality: { type: "string" },
			"gallery-only": { type: "boolean", default: false },
			format: { type: "string" },
			publish: { type: "string" },
		},
	});
	const collage = values.collage === true;
	const galleryOnly = values["gallery-only"] === true;
	const quality = pickQuality(values.quality);
	const publish = pickPicks(values.publish);
	const publishOnly = publish.length > 0 && values.scene === undefined;
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
	const formats =
		values.format === undefined
			? []
			: pickIds(values.format, FORMAT_IDS, "format");
	return {
		scenes,
		themes,
		collage,
		quality,
		galleryOnly,
		formats,
		publish,
		publishOnly,
	};
}

export function formatHelp(opts: CaptureCatalog): string {
	const qualities = QUALITY_IDS.map(
		(id) => `${id} (${QUALITY_PROFILES[id]}x)`,
	).join(", ");
	return (
		"Usage: bun run screenshots [--scene ID[,ID...]] [--theme ID[,ID...]] [--collage] [--quality ID] [--gallery-only]\n" +
		`Scenes: ${opts.sceneIds.join(", ")}, all\n` +
		`Themes: ${opts.themeIds.join(", ")}, all\n` +
		`Quality: ${qualities}\n` +
		`Default: ${opts.sceneIds[0]} in dark; --collage defaults to ${COLLAGE_THEMES}\n` +
		"and composes the first requested scene across the requested themes.\n" +
		`--format composes promo images (${FORMAT_IDS.join(", ")}, all) from each capture into artifacts/showcase/promo/.\n` +
		"--gallery-only rebuilds artifacts/showcase/index.html from disk, skipping capture.\n" +
		"--publish PICK[,PICK...] copies named outputs from artifacts/showcase/ into\n" +
		"screenshots/; a default run never touches screenshots/. Pick grammar:\n" +
		"  capture:<scene>:<theme>[:<quality>]   -> screenshots/<scene>-<theme>.png\n" +
		"  promo:<format>:<scene>:<theme>        -> screenshots/promo/<format>-<scene>-<theme>.png\n" +
		"  collage:<scene>[:<quality>]           -> screenshots/collage-<scene>.png\n" +
		"(quality defaults to standard in a pick). --publish with no --scene skips capture.\n"
	);
}
