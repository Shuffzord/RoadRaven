import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FORMAT_IDS } from "../../../scripts/screenshots/promo";
import {
	parsePick,
	publishOutputs,
} from "../../../scripts/screenshots/publish";
import { SCENE_IDS } from "../../../scripts/screenshots/scenes";
import { THEME_IDS } from "../../../src/mainview/themes";

const scene = SCENE_IDS[0];
const theme = THEME_IDS[0];
const format = FORMAT_IDS[0];

let showcaseDir = "";
let screenshotsDir = "";

afterEach(async () => {
	if (showcaseDir) await rm(showcaseDir, { recursive: true, force: true });
	if (screenshotsDir)
		await rm(screenshotsDir, { recursive: true, force: true });
	showcaseDir = "";
	screenshotsDir = "";
});

async function makeDirs(): Promise<void> {
	showcaseDir = await mkdtemp(join(tmpdir(), "showcase-src-"));
	screenshotsDir = await mkdtemp(join(tmpdir(), "showcase-dst-"));
}

describe("parsePick", () => {
	it("parses a capture pick, defaulting quality to standard", () => {
		expect(parsePick(`capture:${scene}:${theme}`)).toEqual({
			kind: "capture",
			scene,
			theme,
			quality: "standard",
		});
	});

	it("parses a capture pick with an explicit quality", () => {
		expect(parsePick(`capture:${scene}:${theme}:preview`)).toEqual({
			kind: "capture",
			scene,
			theme,
			quality: "preview",
		});
	});

	it("parses a promo pick", () => {
		expect(parsePick(`promo:${format}:${scene}:${theme}`)).toEqual({
			kind: "promo",
			format,
			scene,
			theme,
		});
	});

	it("parses a collage pick, defaulting quality to standard", () => {
		expect(parsePick(`collage:${scene}`)).toEqual({
			kind: "collage",
			scene,
			quality: "standard",
		});
	});

	it("parses a collage pick with an explicit quality", () => {
		expect(parsePick(`collage:${scene}:ultra`)).toEqual({
			kind: "collage",
			scene,
			quality: "ultra",
		});
	});

	it("throws on an unknown kind", () => {
		expect(() => parsePick("poster:x:y")).toThrow(/poster/);
	});

	it("throws on an unknown scene", () => {
		expect(() => parsePick(`capture:nope:${theme}`)).toThrow(/nope/);
	});

	it("throws on an unknown theme", () => {
		expect(() => parsePick(`capture:${scene}:nope`)).toThrow(/nope/);
	});

	it("throws on an unknown quality", () => {
		expect(() => parsePick(`capture:${scene}:${theme}:nope`)).toThrow(/nope/);
	});

	it("throws on an unknown format", () => {
		expect(() => parsePick(`promo:nope:${scene}:${theme}`)).toThrow(/nope/);
	});

	it("throws on wrong arity", () => {
		expect(() => parsePick(`capture:${scene}`)).toThrow();
		expect(() => parsePick(`promo:${format}:${scene}`)).toThrow();
		expect(() => parsePick(`collage:${scene}:standard:extra`)).toThrow();
	});
});

describe("publishOutputs", () => {
	it("copies a capture pick to its stable destination, byte-identical", async () => {
		await makeDirs();
		const srcDir = join(showcaseDir, "captures", "standard", scene);
		await mkdir(srcDir, { recursive: true });
		const src = join(srcDir, `${theme}.png`);
		const bytes = Buffer.from([1, 2, 3, 4, 5]);
		await writeFile(src, bytes);

		const result = await publishOutputs(showcaseDir, screenshotsDir, [
			`capture:${scene}:${theme}:standard`,
		]);

		const to = join(screenshotsDir, `${scene}-${theme}.png`);
		expect(result).toEqual([{ from: src, to, bytes: bytes.length }]);
		expect(await readFile(to)).toEqual(bytes);
	});

	it("copies a promo pick to screenshots/promo/", async () => {
		await makeDirs();
		const srcDir = join(showcaseDir, "promo", format);
		await mkdir(srcDir, { recursive: true });
		const src = join(srcDir, `${scene}-${theme}.png`);
		const bytes = Buffer.from("promo-bytes");
		await writeFile(src, bytes);

		const result = await publishOutputs(showcaseDir, screenshotsDir, [
			`promo:${format}:${scene}:${theme}`,
		]);

		const to = join(screenshotsDir, "promo", `${format}-${scene}-${theme}.png`);
		expect(result).toEqual([{ from: src, to, bytes: bytes.length }]);
		expect(await readFile(to)).toEqual(bytes);
	});

	it("copies a collage pick to screenshots/collage-<scene>.png", async () => {
		await makeDirs();
		const srcDir = join(showcaseDir, "collage", "standard");
		await mkdir(srcDir, { recursive: true });
		const src = join(srcDir, `${scene}.png`);
		const bytes = Buffer.from("collage-bytes");
		await writeFile(src, bytes);

		const result = await publishOutputs(showcaseDir, screenshotsDir, [
			`collage:${scene}:standard`,
		]);

		const to = join(screenshotsDir, `collage-${scene}.png`);
		expect(result).toEqual([{ from: src, to, bytes: bytes.length }]);
		expect(await readFile(to)).toEqual(bytes);
	});

	it("a missing source throws naming the pick", async () => {
		await makeDirs();
		const pick = `capture:${scene}:${theme}:standard`;
		await expect(
			publishOutputs(showcaseDir, screenshotsDir, [pick]),
		).rejects.toThrow(pick);
	});

	it("writes nothing outside screenshotsDir", async () => {
		await makeDirs();
		const srcDir = join(showcaseDir, "captures", "standard", scene);
		await mkdir(srcDir, { recursive: true });
		await writeFile(join(srcDir, `${theme}.png`), Buffer.from([9]));

		const result = await publishOutputs(showcaseDir, screenshotsDir, [
			`capture:${scene}:${theme}:standard`,
		]);

		for (const file of result) {
			expect(file.to.startsWith(screenshotsDir)).toBe(true);
		}
		// The source tree gained no new files: publish only reads from showcaseDir.
		expect(await readdir(srcDir)).toEqual([`${theme}.png`]);
	});

	it("an empty pick list is a no-op", async () => {
		await makeDirs();
		const result = await publishOutputs(showcaseDir, screenshotsDir, []);
		expect(result).toEqual([]);
		await expect(readdir(screenshotsDir)).resolves.toEqual([]);
	});
});
