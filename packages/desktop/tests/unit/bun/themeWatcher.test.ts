// v0.8.3 Phase 4: the themes dir watcher — a debounced "these ids changed"
// signal for the renderer's hot reload.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// themes.ts reaches the platform seam (electrobun/bun) for reveal-in-folder.
vi.mock("../../../src/bun/platform/shell", () => ({
	showItemInFolder: vi.fn(() => ({ ok: true })),
	openExternal: vi.fn(() => ({ ok: true })),
}));

import { getThemesDir } from "../../../src/bun/themes";
import {
	startThemeWatcher,
	stopThemeWatcher,
} from "../../../src/bun/themeWatcher";

describe("themeWatcher", () => {
	let base: string;

	beforeEach(() => {
		base = mkdtempSync(join(tmpdir(), "rr-theme-watch-"));
	});

	afterEach(() => {
		stopThemeWatcher();
		try {
			rmSync(base, { recursive: true, force: true });
		} catch {
			// Windows may still hold the directory handle briefly.
		}
	});

	it("a write in the themes dir emits one debounced event naming the id", async () => {
		const onChanged = vi.fn();
		startThemeWatcher(onChanged, { basePath: base, debounceMs: 100 });
		await new Promise((r) => setTimeout(r, 50));

		const file = join(getThemesDir({ basePath: base }), "mine.json");
		writeFileSync(file, "{}", "utf-8");
		await new Promise((r) => setTimeout(r, 20));
		writeFileSync(file, "{ }", "utf-8");

		await vi.waitFor(() => expect(onChanged).toHaveBeenCalled(), {
			timeout: 2000,
		});
		await new Promise((r) => setTimeout(r, 250));
		expect(onChanged).toHaveBeenCalledTimes(1);
		expect(onChanged).toHaveBeenCalledWith(["mine"]);
	});

	it("a write outside the themes dir does not emit", async () => {
		const onChanged = vi.fn();
		startThemeWatcher(onChanged, { basePath: base, debounceMs: 50 });
		await new Promise((r) => setTimeout(r, 50));

		writeFileSync(join(base, "settings.json"), "{}", "utf-8");
		await new Promise((r) => setTimeout(r, 300));
		expect(onChanged).not.toHaveBeenCalled();
	});

	it("stopThemeWatcher silences further writes", async () => {
		const onChanged = vi.fn();
		startThemeWatcher(onChanged, { basePath: base, debounceMs: 50 });
		await new Promise((r) => setTimeout(r, 50));
		stopThemeWatcher();

		writeFileSync(join(base, "themes", "late.json"), "{}", "utf-8");
		await new Promise((r) => setTimeout(r, 300));
		expect(onChanged).not.toHaveBeenCalled();
	});
});
