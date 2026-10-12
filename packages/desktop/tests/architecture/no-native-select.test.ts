// tests/architecture/no-native-select.test.ts
//
// On Linux the renderer is CEF, and a native <select> there never opens its
// popup (v0.9.0: the side panel's Status/Type and the Event Log filters were
// dead on Linux, fine on Windows' WebView2). Dropdowns use MenuSelect, which
// draws its list in the page with Radix DropdownMenu.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAINVIEW = join(__dirname, "..", "..", "src", "mainview");

describe("Architecture: no native <select> in the renderer", () => {
	it("no .tsx file under src/mainview renders a <select>", () => {
		const hits = readdirSync(MAINVIEW, { recursive: true, encoding: "utf-8" })
			.filter((rel) => rel.endsWith(".tsx"))
			.filter((rel) =>
				/<select\b/.test(readFileSync(join(MAINVIEW, rel), "utf-8")),
			);
		expect(
			hits,
			"Native <select> popups don't open in CEF on Linux; use MenuSelect.",
		).toEqual([]);
	});
});
