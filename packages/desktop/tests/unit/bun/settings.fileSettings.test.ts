/**
 * v0.8.4 Phase 2 — saveSettings must merge `fileSettings` per path, one level
 * deeper than the top-level spread: a write of `{[p]: {layout}}` must not
 * wipe a previously-saved `{[p]: {layoutKnobs}}` for the SAME path, and a
 * different path must be untouched either way.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSettings, saveSettings } from "../../../src/bun/settings";

const PATH_A = "C:/a.json";
const PATH_B = "C:/b.json";

describe("saveSettings — per-path fileSettings merge", () => {
	let baseDir: string;

	beforeEach(() => {
		baseDir = mkdtempSync(join(tmpdir(), "rr-settings-"));
	});

	afterEach(() => {
		try {
			rmSync(baseDir, { recursive: true, force: true });
		} catch {
			// ignore Windows file handle delays
		}
	});

	it("keeps a path's layoutKnobs after a later layout-only write to the same path", () => {
		saveSettings({ fileSettings: { [PATH_A]: { layout: "LR" } } }, baseDir);
		saveSettings(
			{
				fileSettings: {
					[PATH_A]: {
						layoutKnobs: { siblingGap: 1.5, depthGap: 1.0, density: "compact" },
					},
				},
			},
			baseDir,
		);

		const settings = loadSettings(baseDir);
		expect(settings.fileSettings?.[PATH_A]).toEqual({
			layout: "LR",
			layoutKnobs: { siblingGap: 1.5, depthGap: 1.0, density: "compact" },
		});
	});

	it("keeps a path's layout after a later knobs-only write to the same path", () => {
		saveSettings(
			{
				fileSettings: {
					[PATH_A]: {
						layoutKnobs: { siblingGap: 1.5, depthGap: 1.0, density: "compact" },
					},
				},
			},
			baseDir,
		);
		saveSettings({ fileSettings: { [PATH_A]: { layout: "LR" } } }, baseDir);

		const settings = loadSettings(baseDir);
		expect(settings.fileSettings?.[PATH_A]).toEqual({
			layout: "LR",
			layoutKnobs: { siblingGap: 1.5, depthGap: 1.0, density: "compact" },
		});
	});

	it("leaves a different path untouched", () => {
		saveSettings({ fileSettings: { [PATH_A]: { layout: "LR" } } }, baseDir);
		saveSettings({ fileSettings: { [PATH_B]: { layout: "TB" } } }, baseDir);

		const settings = loadSettings(baseDir);
		expect(settings.fileSettings?.[PATH_A]).toEqual({ layout: "LR" });
		expect(settings.fileSettings?.[PATH_B]).toEqual({ layout: "TB" });
	});
});
