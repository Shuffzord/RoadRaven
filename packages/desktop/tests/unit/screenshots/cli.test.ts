import { describe, expect, it } from "vitest";
import { formatHelp, parseCaptureArgs } from "../../../scripts/screenshots/cli";
import { FORMAT_IDS } from "../../../scripts/screenshots/promo";
import { SCENE_IDS } from "../../../scripts/screenshots/scenes";
import { THEME_IDS } from "../../../src/mainview/themes";

// Pick strings are validated against the real scene/theme catalogs (parsePick
// owns that grammar), not the local `opts` fixture used for the scene/theme axes below.
const realScene = SCENE_IDS[0];
const realTheme = THEME_IDS[0];

const opts = {
	themeIds: ["dark", "light", "amber", "moss"],
	sceneIds: ["cfa-overview", "cfa-detail", "agent-workflow"],
} as const;

describe("parseCaptureArgs", () => {
	it("defaults to the first scene in dark, no collage", () => {
		expect(parseCaptureArgs([], opts)).toEqual({
			scenes: ["cfa-overview"],
			themes: ["dark"],
			collage: false,
			quality: "preview",
			galleryOnly: false,
			formats: [],
			publish: [],
			publishOnly: false,
		});
	});

	it("parses comma lists for scenes and themes", () => {
		expect(
			parseCaptureArgs(
				["--scene", "agent-workflow,cfa-detail", "--theme", "moss,light"],
				opts,
			),
		).toEqual({
			scenes: ["agent-workflow", "cfa-detail"],
			themes: ["moss", "light"],
			collage: false,
			quality: "preview",
			galleryOnly: false,
			formats: [],
			publish: [],
			publishOnly: false,
		});
	});

	it("expands `all` on both axes in catalog order", () => {
		const request = parseCaptureArgs(
			["--scene", "all", "--theme", "all"],
			opts,
		);
		expect(request.scenes).toEqual([...opts.sceneIds]);
		expect(request.themes).toEqual([...opts.themeIds]);
	});

	it("dedupes while preserving first-seen order", () => {
		const request = parseCaptureArgs(
			[
				"--scene",
				"cfa-detail, cfa-overview,cfa-detail",
				"--theme",
				"light,dark,light",
			],
			opts,
		);
		expect(request.scenes).toEqual(["cfa-detail", "cfa-overview"]);
		expect(request.themes).toEqual(["light", "dark"]);
	});

	it("a collage defaults to four themes", () => {
		expect(parseCaptureArgs(["--collage"], opts)).toEqual({
			scenes: ["cfa-overview"],
			themes: ["dark", "light", "amber", "moss"],
			collage: true,
			quality: "preview",
			galleryOnly: false,
			formats: [],
			publish: [],
			publishOnly: false,
		});
	});

	it("a collage needs at least two themes", () => {
		expect(() =>
			parseCaptureArgs(["--collage", "--theme", "dark"], opts),
		).toThrow(/at least two themes/);
	});

	it("throws on an unknown scene", () => {
		expect(() => parseCaptureArgs(["--scene", "nope"], opts)).toThrow(
			/Unknown scene 'nope'/,
		);
	});

	it("throws on an unknown theme", () => {
		expect(() => parseCaptureArgs(["--theme", "dark,nope"], opts)).toThrow(
			/Unknown theme 'nope'/,
		);
	});

	it("throws on an unknown option", () => {
		expect(() => parseCaptureArgs(["--bogus"], opts)).toThrow();
	});

	it("throws on a stray positional argument", () => {
		expect(() => parseCaptureArgs(["dark"], opts)).toThrow();
	});

	// RC2 (v0.8.6 Phase 2 flips this): quality presets are now implemented.
	it("accepts --quality standard", () => {
		expect(parseCaptureArgs(["--quality", "standard"], opts).quality).toBe(
			"standard",
		);
	});

	it("defaults to preview quality when --quality is omitted", () => {
		expect(parseCaptureArgs([], opts).quality).toBe("preview");
	});

	it("throws on an unknown quality", () => {
		expect(() => parseCaptureArgs(["--quality", "nope"], opts)).toThrow(
			/Unknown quality 'nope'/,
		);
	});

	it("--gallery-only parses, defaults false", () => {
		expect(parseCaptureArgs([], opts).galleryOnly).toBe(false);
		expect(parseCaptureArgs(["--gallery-only"], opts).galleryOnly).toBe(true);
	});

	it("--format parses a comma list and expands `all`", () => {
		expect(
			parseCaptureArgs(["--format", "social-card,readme-hero"], opts).formats,
		).toEqual(["social-card", "readme-hero"]);
		expect(parseCaptureArgs(["--format", "all"], opts).formats).toEqual([
			...FORMAT_IDS,
		]);
	});

	it("throws on an unknown format", () => {
		expect(() => parseCaptureArgs(["--format", "poster"], opts)).toThrow(
			/Unknown format 'poster'/,
		);
	});

	it("--publish parses a comma list of picks; empty when omitted", () => {
		expect(parseCaptureArgs([], opts).publish).toEqual([]);
		const picks = `capture:${realScene}:${realTheme},collage:${realScene}`;
		expect(parseCaptureArgs(["--publish", picks], opts).publish).toEqual([
			`capture:${realScene}:${realTheme}`,
			`collage:${realScene}`,
		]);
	});

	it("publish-only: --publish without --scene skips capture; with --scene it does not", () => {
		const pick = `capture:${realScene}:${realTheme}`;
		expect(parseCaptureArgs(["--publish", pick], opts).publishOnly).toBe(true);
		expect(
			parseCaptureArgs(["--scene", opts.sceneIds[0], "--publish", pick], opts)
				.publishOnly,
		).toBe(false);
	});

	it("throws on a malformed pick", () => {
		expect(() => parseCaptureArgs(["--publish", "bogus:x"], opts)).toThrow();
	});
});

describe("formatHelp", () => {
	it("lists every scene and theme id", () => {
		const help = formatHelp(opts);
		for (const id of [...opts.sceneIds, ...opts.themeIds]) {
			expect(help).toContain(id);
		}
	});

	it("lists all three quality ids", () => {
		const help = formatHelp(opts);
		for (const id of ["preview", "standard", "ultra"]) {
			expect(help).toContain(id);
		}
	});
});
