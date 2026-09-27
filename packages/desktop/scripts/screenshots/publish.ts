import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { THEME_IDS } from "../../src/mainview/themes";
import { FORMAT_IDS, type FormatId } from "./promo";
import { QUALITY_IDS, type QualityId } from "./quality";
import { SCENE_IDS } from "./scenes";

/** Quality default when a `capture`/`collage` pick omits it. */
const PICK_DEFAULT_QUALITY: QualityId = "standard";

export type Pick =
	| { kind: "capture"; scene: string; theme: string; quality: QualityId }
	| { kind: "promo"; format: FormatId; scene: string; theme: string }
	| { kind: "collage"; scene: string; quality: QualityId };

export interface PublishedFile {
	from: string;
	to: string;
	bytes: number;
}

function assertKnown(
	value: string | undefined,
	known: readonly string[],
	axis: string,
	pick: string,
): string {
	if (value === undefined || !known.includes(value)) {
		throw new Error(
			`Bad pick '${pick}': unknown ${axis} '${value}'. Choose: ${known.join(", ")}`,
		);
	}
	return value;
}

/**
 * Parse one `--publish` pick: `capture:<scene>:<theme>[:<quality>]`,
 * `promo:<format>:<scene>:<theme>`, or `collage:<scene>[:<quality>]`.
 * Throws naming the pick and the grammar on anything else.
 */
export function parsePick(text: string): Pick {
	const [kind, ...rest] = text.split(":");
	if (kind === "capture") {
		if (rest.length < 2 || rest.length > 3) {
			throw new Error(
				`Bad pick '${text}': expected capture:<scene>:<theme>[:<quality>]`,
			);
		}
		const [scene, theme, quality] = rest;
		return {
			kind,
			scene: assertKnown(scene, SCENE_IDS, "scene", text),
			theme: assertKnown(theme, THEME_IDS, "theme", text),
			quality: assertKnown(
				quality ?? PICK_DEFAULT_QUALITY,
				QUALITY_IDS,
				"quality",
				text,
			) as QualityId,
		};
	}
	if (kind === "promo") {
		if (rest.length !== 3) {
			throw new Error(
				`Bad pick '${text}': expected promo:<format>:<scene>:<theme>`,
			);
		}
		const [format, scene, theme] = rest;
		return {
			kind,
			format: assertKnown(format, FORMAT_IDS, "format", text) as FormatId,
			scene: assertKnown(scene, SCENE_IDS, "scene", text),
			theme: assertKnown(theme, THEME_IDS, "theme", text),
		};
	}
	if (kind === "collage") {
		if (rest.length < 1 || rest.length > 2) {
			throw new Error(
				`Bad pick '${text}': expected collage:<scene>[:<quality>]`,
			);
		}
		const [scene, quality] = rest;
		return {
			kind,
			scene: assertKnown(scene, SCENE_IDS, "scene", text),
			quality: assertKnown(
				quality ?? PICK_DEFAULT_QUALITY,
				QUALITY_IDS,
				"quality",
				text,
			) as QualityId,
		};
	}
	throw new Error(
		`Bad pick '${text}': unknown kind '${kind}'. Expected capture:, promo: or collage:.`,
	);
}

/** The pick's source path under `showcaseDir`, as written by the capture run. */
function sourceFor(showcaseDir: string, pick: Pick): string {
	if (pick.kind === "capture") {
		return join(
			showcaseDir,
			"captures",
			pick.quality,
			pick.scene,
			`${pick.theme}.png`,
		);
	}
	if (pick.kind === "promo") {
		return join(
			showcaseDir,
			"promo",
			pick.format,
			`${pick.scene}-${pick.theme}.png`,
		);
	}
	return join(showcaseDir, "collage", pick.quality, `${pick.scene}.png`);
}

/** The pick's destination under `screenshotsDir`, derived from the pick alone. */
function destinationFor(pick: Pick): string {
	if (pick.kind === "capture") return `${pick.scene}-${pick.theme}.png`;
	if (pick.kind === "promo") {
		return join("promo", `${pick.format}-${pick.scene}-${pick.theme}.png`);
	}
	return `collage-${pick.scene}.png`;
}

/**
 * Copy each pick from `showcaseDir` to its stable, explicit destination under
 * `screenshotsDir`. Throws naming the pick when its source is missing.
 * Destinations are derived from the pick, never the source path, so they stay
 * stable across quality changes.
 */
export async function publishOutputs(
	showcaseDir: string,
	screenshotsDir: string,
	picks: readonly string[],
): Promise<PublishedFile[]> {
	const published: PublishedFile[] = [];
	for (const text of picks) {
		const pick = parsePick(text);
		const from = sourceFor(showcaseDir, pick);
		const to = join(screenshotsDir, destinationFor(pick));
		let bytes: number;
		try {
			bytes = (await stat(from)).size;
		} catch {
			throw new Error(`Pick '${text}': source not found at ${from}`);
		}
		await mkdir(dirname(to), { recursive: true });
		await copyFile(from, to);
		published.push({ from, to, bytes });
	}
	return published;
}
