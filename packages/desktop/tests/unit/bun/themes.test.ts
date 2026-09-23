// v0.8.3 Phase 4 (RC1 / F9): user themes as files in <userData>/themes.
// Every read path validates through ThemeFileSchema; invalid files are
// reported as { id, error } entries and never thrown past the RPC boundary.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeFile } from "../../../../../shared/themeSchema";

vi.mock("../../../src/bun/platform/shell", () => ({
	showItemInFolder: vi.fn(() => ({ ok: true })),
	openExternal: vi.fn(() => ({ ok: true })),
}));

import { showItemInFolder } from "../../../src/bun/platform/shell";
import {
	deleteUserTheme,
	duplicateTheme,
	getThemesDir,
	importThemeFile,
	listUserThemes,
	readUserTheme,
	revealThemesFolder,
	slugifyThemeId,
	updateUserTheme,
	writeUserTheme,
} from "../../../src/bun/themes";
import { themeForId } from "../../../src/mainview/themes";

const RESERVED = ["dark", "light", "amber"];

// A user theme is a built-in's colours under a new id (what Duplicate makes).
const valid: ThemeFile = {
	id: "mine",
	meta: { name: "Mine", mode: "dark", author: "me" },
	colors: themeForId("dark").colors,
};

/** A dark theme whose text is barely lighter than its base — required pairs fail. */
const lowContrast: ThemeFile = {
	...valid,
	id: "murky",
	meta: { name: "Murky", mode: "dark" },
	colors: {
		...valid.colors,
		"text-primary": "#3a3a3a",
		"text-secondary": "#2a2a2a",
	},
};

describe("bun/themes", () => {
	let base: string;
	const put = (name: string, content: string) =>
		writeFileSync(
			join(getThemesDir({ basePath: base }), name),
			content,
			"utf-8",
		);

	beforeEach(() => {
		base = mkdtempSync(join(tmpdir(), "rr-themes-test-"));
		vi.clearAllMocks();
	});

	afterEach(() => {
		rmSync(base, { recursive: true, force: true });
	});

	it("getThemesDir is <userData>/themes and creates it on first use", () => {
		const dir = getThemesDir({ basePath: base });
		expect(dir).toBe(join(base, "themes"));
		expect(existsSync(dir)).toBe(true);
	});

	it("lists nothing on a fresh dir", () => {
		expect(listUserThemes({ basePath: base })).toEqual([]);
	});

	it("lists a valid file with its parsed file and 0 required contrast failures", () => {
		put("mine.json", JSON.stringify(valid));
		const entries = listUserThemes({ basePath: base, reservedIds: RESERVED });
		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual({
			id: "mine",
			file: valid,
			requiredFailures: 0,
		});
	});

	it("reports the required-tier contrast failure count without blocking the entry", () => {
		put("murky.json", JSON.stringify(lowContrast));
		const [entry] = listUserThemes({ basePath: base });
		expect(entry.file).toEqual(lowContrast);
		expect(entry.requiredFailures).toBeGreaterThan(0);
		expect(entry.error).toBeUndefined();
	});

	it("lists invalid JSON as { id, error } and keeps listing the rest", () => {
		put("broken.json", "{ not json");
		put("mine.json", JSON.stringify(valid));
		const entries = listUserThemes({ basePath: base });
		expect(entries.map((e) => e.id)).toEqual(["broken", "mine"]);
		expect(entries[0].file).toBeUndefined();
		expect(entries[0].error).toMatch(/JSON/);
	});

	it("lists a schema-invalid file with the first issue as the reason", () => {
		put(
			"bad.json",
			JSON.stringify({
				...valid,
				id: "bad",
				colors: { ...valid.colors, accent: "red; background: url(x)" },
			}),
		);
		const [entry] = listUserThemes({ basePath: base });
		expect(entry.file).toBeUndefined();
		expect(entry.error).toMatch(/colors\.accent/);
	});

	it("a file whose id differs from its basename is invalid", () => {
		put("other.json", JSON.stringify(valid));
		const [entry] = listUserThemes({ basePath: base });
		expect(entry.id).toBe("other");
		expect(entry.file).toBeUndefined();
		expect(entry.error).toMatch(/id "mine" .* "other"/);
	});

	it("a user id that collides with a built-in id is invalid", () => {
		put("dark.json", JSON.stringify({ ...valid, id: "dark" }));
		const [entry] = listUserThemes({ basePath: base, reservedIds: RESERVED });
		expect(entry.file).toBeUndefined();
		expect(entry.error).toBe('shadows built-in "dark"');
	});

	it("ignores non-json files", () => {
		put("notes.txt", "hello");
		expect(listUserThemes({ basePath: base })).toEqual([]);
	});

	it("readUserTheme reads one entry and refuses ids that are not theme ids", () => {
		put("mine.json", JSON.stringify(valid));
		expect(readUserTheme("mine", { basePath: base }).file).toEqual(valid);
		expect(readUserTheme("nope", { basePath: base }).error).toMatch(
			/not found/,
		);
		expect(readUserTheme("../settings", { basePath: base }).error).toMatch(
			/not a theme id/,
		);
	});

	it("writeUserTheme validates, writes <id>.json and re-lists", () => {
		const result = writeUserTheme(valid, { basePath: base });
		expect(result).toEqual({ ok: true, id: "mine" });
		const onDisk = JSON.parse(
			readFileSync(join(base, "themes", "mine.json"), "utf-8"),
		);
		expect(onDisk).toEqual(valid);
		expect(listUserThemes({ basePath: base })[0].id).toBe("mine");
	});

	it("writeUserTheme refuses an invalid file and a reserved id without writing", () => {
		expect(writeUserTheme({ id: "x" }, { basePath: base }).ok).toBe(false);
		const reserved = writeUserTheme(
			{ ...valid, id: "amber" },
			{ basePath: base, reservedIds: RESERVED },
		);
		expect(reserved).toEqual({
			ok: false,
			error: 'shadows built-in "amber"',
		});
		expect(listUserThemes({ basePath: base })).toEqual([]);
	});

	// v0.8.3 Phase 5: the editor's autosave. It never creates — Duplicate does
	// — so an id without a file is refused, and a good file is overwritten.
	it("updateUserTheme refuses an id with no file yet and overwrites an existing one", () => {
		expect(updateUserTheme(valid, { basePath: base })).toEqual({
			ok: false,
			error: 'no user theme "mine" to update',
		});
		expect(existsSync(join(base, "themes", "mine.json"))).toBe(false);

		put("mine.json", JSON.stringify(valid));
		const edited = { ...valid, colors: { ...valid.colors, accent: "#ff00ff" } };
		expect(updateUserTheme(edited, { basePath: base })).toEqual({
			ok: true,
			id: "mine",
		});
		expect(listUserThemes({ basePath: base })[0].file).toEqual(edited);

		expect(updateUserTheme({ id: "mine" }, { basePath: base }).ok).toBe(false);
		expect(
			updateUserTheme(
				{ ...valid, id: "amber" },
				{ basePath: base, reservedIds: RESERVED },
			),
		).toEqual({ ok: false, error: 'shadows built-in "amber"' });
	});

	it("slugifyThemeId turns a display name into a theme id", () => {
		expect(slugifyThemeId("My Theme!")).toBe("my-theme");
		expect(slugifyThemeId("  Amber  copy ")).toBe("amber-copy");
		expect(slugifyThemeId("2nd")).toBe("theme-2nd");
		expect(slugifyThemeId("!!!")).toBeNull();
	});

	it("duplicateTheme writes the source under the slug, renamed, author unset", () => {
		const result = duplicateTheme(valid, "Mine Two", {
			basePath: base,
			reservedIds: RESERVED,
		});
		expect(result).toEqual({ ok: true, id: "mine-two" });
		const [entry] = listUserThemes({ basePath: base });
		expect(entry.id).toBe("mine-two");
		expect(entry.file?.meta).toEqual({ name: "Mine Two", mode: "dark" });
		expect(entry.file?.colors).toEqual(valid.colors);
	});

	it("duplicateTheme refuses a built-in name, an existing id and an empty name", () => {
		expect(
			duplicateTheme(valid, "Dark", { basePath: base, reservedIds: RESERVED }),
		).toEqual({ ok: false, error: 'shadows built-in "dark"' });
		put("mine.json", JSON.stringify(valid));
		expect(duplicateTheme(valid, "mine", { basePath: base }).ok).toBe(false);
		expect(duplicateTheme(valid, "???", { basePath: base }).ok).toBe(false);
		expect(listUserThemes({ basePath: base })).toHaveLength(1);
	});

	it("importThemeFile copies only valid files into the dir, named by id", () => {
		const src = join(base, "shared-theme.json");
		writeFileSync(src, JSON.stringify(valid), "utf-8");
		expect(importThemeFile(src, { basePath: base })).toEqual({
			ok: true,
			id: "mine",
		});
		expect(existsSync(join(base, "themes", "mine.json"))).toBe(true);

		const bad = join(base, "bad.json");
		writeFileSync(bad, "nope", "utf-8");
		expect(importThemeFile(bad, { basePath: base }).ok).toBe(false);
		const missing = join(base, "missing.json");
		expect(importThemeFile(missing, { basePath: base }).ok).toBe(false);
		expect(listUserThemes({ basePath: base })).toHaveLength(1);
	});

	// v0.8.3 Phase 7 (D-11): deleting a user theme. The id is checked before
	// it becomes a path, so nothing outside the themes dir can be unlinked.
	it("deleteUserTheme unlinks an existing user file", () => {
		put("mine.json", JSON.stringify(valid));
		put("murky.json", JSON.stringify(lowContrast));
		expect(
			deleteUserTheme("mine", { basePath: base, reservedIds: RESERVED }),
		).toEqual({ ok: true });
		expect(existsSync(join(base, "themes", "mine.json"))).toBe(false);
		expect(listUserThemes({ basePath: base }).map((e) => e.id)).toEqual([
			"murky",
		]);
	});

	it("deleteUserTheme refuses a built-in id, a missing id and an id that is not a theme id", () => {
		put("mine.json", JSON.stringify(valid));
		// A stray file under a built-in's id is never touched through delete.
		put("amber.json", JSON.stringify({ ...valid, id: "amber" }));
		const reserved = deleteUserTheme("amber", {
			basePath: base,
			reservedIds: RESERVED,
		});
		expect(reserved.ok).toBe(false);
		expect(!reserved.ok && reserved.error).toMatch(/built-in/);
		expect(existsSync(join(base, "themes", "amber.json"))).toBe(true);

		const missing = deleteUserTheme("nope", { basePath: base });
		expect(missing.ok).toBe(false);
		expect(!missing.ok && missing.error).toMatch(/no user theme "nope"/);

		// Outside the dir: the pattern refuses it before any path is built.
		writeFileSync(join(base, "settings.json"), "{}", "utf-8");
		const outside = deleteUserTheme("../settings", { basePath: base });
		expect(outside).toEqual({ ok: false, error: "not a theme id" });
		expect(existsSync(join(base, "settings.json"))).toBe(true);
		expect(deleteUserTheme("Mine", { basePath: base }).ok).toBe(false);
		expect(existsSync(join(base, "themes", "mine.json"))).toBe(true);
	});

	it("revealThemesFolder reveals the themes dir through the platform seam", () => {
		mkdirSync(join(base, "themes"), { recursive: true });
		expect(revealThemesFolder({ basePath: base })).toEqual({ ok: true });
		expect(showItemInFolder).toHaveBeenCalledWith(join(base, "themes"));
	});
});
