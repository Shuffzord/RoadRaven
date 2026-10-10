// The roadraven-hud mod keeps byte-for-byte copies of the app's themes.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const src = "packages/desktop/src/mainview/themes";
const copy = "plugins/roadraven-hud/themes";
const jsonIn = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

it("HUD theme copies match the app themes", () => {
	const hint = "run `bun scripts/sync-hud-themes.ts` to resync";
	expect(jsonIn(copy), `theme file names differ: ${hint}`).toEqual(jsonIn(src));
	for (const f of jsonIn(src)) {
		const same = readFileSync(join(copy, f)).equals(readFileSync(join(src, f)));
		expect(same, `${copy}/${f} differs from the app theme: ${hint}`).toBe(true);
	}
});
