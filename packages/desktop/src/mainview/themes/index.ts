/**
 * The built-in theme registry (v0.8.3 Phase 3): one JSON file per theme,
 * validated through the schema at load so a bad built-in fails the unit
 * suite, not the user. This is the single source of theme identity — the
 * picker, the linter, the rendered gate and `ThemePreference` all read ids
 * from here.
 */

import type { ThemeFile } from "../../../../../shared/themeSchema";
import { ThemeFileSchema } from "../../theme/themeFileSchema";
import amberJson from "./amber.json";
import contrastJson from "./contrast.json";
import darkJson from "./dark.json";
import highContrastJson from "./high-contrast.json";
import lightJson from "./light.json";
import mossJson from "./moss.json";
import paperJson from "./paper.json";
import slateJson from "./slate.json";

const parse = (raw: unknown): ThemeFile => ThemeFileSchema.parse(raw);

const amber = parse(amberJson);

/** In picker order. */
export const BUILT_IN_THEMES: readonly ThemeFile[] = [
	parse(darkJson),
	parse(lightJson),
	parse(highContrastJson),
	parse(paperJson),
	amber,
	parse(contrastJson),
	parse(slateJson),
	parse(mossJson),
];

/** The shipped theme ids — the `data-theme` values — in picker order. */
export const THEME_IDS: readonly string[] = BUILT_IN_THEMES.map((t) => t.id);

/** D-8 (owner, 2026-09-23): the app opens in Amber. */
export const DEFAULT_THEME_ID = "amber";

const byId = new Map(BUILT_IN_THEMES.map((t) => [t.id, t]));

export function getBuiltInTheme(id: string): ThemeFile | undefined {
	return byId.get(id);
}

/** The theme to paint for an id: the built-in, or the default when unknown. */
export function themeForId(id: string): ThemeFile {
	return byId.get(id) ?? amber;
}

/**
 * The theme to paint for an id once user themes exist (v0.8.3 Phase 4): a
 * built-in wins over a user file of the same id (the Bun side refuses such
 * files anyway), and an id nobody owns paints the default.
 */
export function resolveThemeFile(
	id: string,
	userThemes: readonly ThemeFile[],
): ThemeFile {
	return byId.get(id) ?? userThemes.find((t) => t.id === id) ?? amber;
}
