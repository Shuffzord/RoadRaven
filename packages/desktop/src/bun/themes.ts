/**
 * User themes as files (v0.8.3 Phase 4, D1-A): `<userData>/themes/<id>.json`
 * in the same format as the built-ins. This module is the only reader and
 * writer of that directory. Every read validates through ThemeFileSchema and
 * reports an invalid file as `{ id, error }` — nothing here throws past the
 * RPC boundary, so a garbage file can never take the app down.
 *
 * The Bun process does not know the built-in registry (it lives in the
 * renderer), so callers pass `reservedIds`: a user file taking one of those
 * ids is invalid ("shadows built-in"), and a write to one is refused.
 */

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { getLogger } from "@logtape/logtape";
import { lintTheme } from "../../../../shared/contrast";
import {
	resolveTheme,
	THEME_ID_PATTERN,
	type ThemeFile,
} from "../../../../shared/themeSchema";
import type {
	ThemeWriteResult,
	UserThemeEntry,
} from "../../../../shared/types";
import { ThemeFileSchema } from "../theme/themeFileSchema";
import { showItemInFolder } from "./platform/shell";
import { getUserDataDir } from "./settings";

const log = getLogger(["bun", "theme"]);

export interface ThemeDirOptions {
	/** Overrides the user data dir (tests). */
	basePath?: string;
	/** Ids a user theme may not take — the built-ins. */
	reservedIds?: readonly string[];
}

/** `<userData>/themes`, created on first use. */
export function getThemesDir(opts: ThemeDirOptions = {}): string {
	const dir = join(opts.basePath ?? getUserDataDir(), "themes");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return dir;
}

function themePath(id: string, opts: ThemeDirOptions): string {
	return join(getThemesDir(opts), `${id}.json`);
}

/**
 * Validates raw JSON as a theme file. `expectedId` is the basename the file
 * was read under (a file whose `id` differs would be listed under one name
 * and painted under another).
 */
function validate(
	raw: unknown,
	opts: ThemeDirOptions,
	expectedId?: string,
): { file: ThemeFile } | { error: string } {
	const parsed = ThemeFileSchema.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		return { error: `${issue.path.join(".")}: ${issue.message}` };
	}
	const file = parsed.data;
	if (expectedId !== undefined && file.id !== expectedId) {
		return {
			error: `id "${file.id}" does not match the file name "${expectedId}"`,
		};
	}
	if (opts.reservedIds?.includes(file.id)) {
		return { error: `shadows built-in "${file.id}"` };
	}
	return { file };
}

function readEntry(path: string, opts: ThemeDirOptions): UserThemeEntry {
	const id = basename(path, ".json");
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf-8"));
	} catch (err) {
		log.warn`invalid JSON in theme file ${path}: ${String(err)}`;
		return { id, error: `invalid JSON: ${String(err)}` };
	}
	const result = validate(raw, opts, id);
	if ("error" in result) {
		log.warn`invalid theme file ${path}: ${result.error}`;
		return { id, error: result.error };
	}
	const requiredFailures = lintTheme(resolveTheme(result.file)).filter(
		(f) => f.tier === "required" && !f.pass,
	).length;
	return { id, file: result.file, requiredFailures };
}

/** Every `*.json` in the themes dir, by id, valid or not. */
export function listUserThemes(opts: ThemeDirOptions = {}): UserThemeEntry[] {
	const dir = getThemesDir(opts);
	const names = readdirSync(dir)
		.filter((name) => name.endsWith(".json"))
		.sort();
	log.debug`scanned ${dir}: ${names.length} theme file(s)`;
	return names.map((name) => readEntry(join(dir, name), opts));
}

/** One theme by id. The id is checked before it becomes a path. */
export function readUserTheme(
	id: string,
	opts: ThemeDirOptions = {},
): UserThemeEntry {
	if (!THEME_ID_PATTERN.test(id)) return { id, error: "not a theme id" };
	const path = themePath(id, opts);
	if (!existsSync(path)) return { id, error: "not found" };
	return readEntry(path, opts);
}

function writeValidated(
	raw: unknown,
	opts: ThemeDirOptions,
	mustBeNew: boolean,
): ThemeWriteResult {
	const result = validate(raw, opts);
	if ("error" in result) return { ok: false, error: result.error };
	const path = themePath(result.file.id, opts);
	if (mustBeNew && existsSync(path)) {
		return {
			ok: false,
			error: `a theme with id "${result.file.id}" already exists`,
		};
	}
	try {
		writeFileSync(path, `${JSON.stringify(result.file, null, 2)}\n`, "utf-8");
	} catch (err) {
		log.error`failed to write theme ${path}: ${String(err)}`;
		return { ok: false, error: `could not write ${path}` };
	}
	log.info`wrote theme ${path}`;
	return { ok: true, id: result.file.id };
}

/** Validates `raw` and writes it as `<id>.json` (overwrites). */
export function writeUserTheme(
	raw: unknown,
	opts: ThemeDirOptions = {},
): ThemeWriteResult {
	return writeValidated(raw, opts, false);
}

/**
 * A theme id for a display name: lowercase, runs of anything else become
 * hyphens; a leading digit gets the `theme-` prefix. `null` when nothing
 * usable is left.
 */
export function slugifyThemeId(name: string): string | null {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (slug === "") return null;
	return THEME_ID_PATTERN.test(slug) ? slug : `theme-${slug}`;
}

/**
 * Writes `source` (a built-in or user file the renderer paints) as a new
 * user theme named `name`: id = slug of the name, `meta.author` unset.
 */
export function duplicateTheme(
	source: unknown,
	name: string,
	opts: ThemeDirOptions = {},
): ThemeWriteResult {
	const id = slugifyThemeId(name);
	if (!id) return { ok: false, error: "the name needs a letter or digit" };
	const parsed = ThemeFileSchema.safeParse(source);
	if (!parsed.success) return { ok: false, error: "not a valid theme" };
	const { author: _author, ...meta } = parsed.data.meta;
	const copy: ThemeFile = {
		...parsed.data,
		id,
		meta: { ...meta, name: name.trim() },
	};
	return writeValidated(copy, opts, true);
}

/** Copies a theme file from anywhere on disk into the themes dir, by id. */
export function importThemeFile(
	sourcePath: string,
	opts: ThemeDirOptions = {},
): ThemeWriteResult {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(sourcePath, "utf-8"));
	} catch (err) {
		log.warn`import refused, ${sourcePath} is not JSON: ${String(err)}`;
		return { ok: false, error: `${basename(sourcePath)} is not a JSON file` };
	}
	const result = validate(raw, opts);
	if ("error" in result) {
		log.warn`import refused, ${sourcePath}: ${result.error}`;
		return { ok: false, error: result.error };
	}
	const path = themePath(result.file.id, opts);
	if (existsSync(path)) {
		return {
			ok: false,
			error: `a theme with id "${result.file.id}" already exists`,
		};
	}
	try {
		copyFileSync(sourcePath, path);
	} catch (err) {
		log.error`failed to import ${sourcePath}: ${String(err)}`;
		return { ok: false, error: `could not write ${path}` };
	}
	log.info`imported theme ${sourcePath} -> ${path}`;
	return { ok: true, id: result.file.id };
}

/** Reveals the themes dir in the OS file manager. */
export function revealThemesFolder(opts: ThemeDirOptions = {}): {
	ok: boolean;
} {
	return showItemInFolder(getThemesDir(opts));
}
