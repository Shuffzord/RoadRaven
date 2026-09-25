import { describe, expect, it } from "vitest";
import { formatHelp, parseCaptureArgs } from "../../../scripts/screenshots/cli";

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

	// RC2 (v0.8.6 Phase 2 flips this): quality presets are not implemented yet.
	it.fails("accepts --quality standard", () => {
		parseCaptureArgs(["--quality", "standard"], opts);
	});
});

describe("formatHelp", () => {
	it("lists every scene and theme id", () => {
		const help = formatHelp(opts);
		for (const id of [...opts.sceneIds, ...opts.themeIds]) {
			expect(help).toContain(id);
		}
	});
});
