// scripts/sync-hud-themes.ts
// plugins/roadraven-hud/themes/*.json are byte-for-byte copies of the app's
// themes (the Claude Code mod reads them at run time and cannot import from
// the app). Run `bun scripts/sync-hud-themes.ts` after changing a theme;
// tests/release/hud-themes.test.ts fails when the two folders drift.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const src = join(import.meta.dir, "../packages/desktop/src/mainview/themes");
const dest = join(import.meta.dir, "../plugins/roadraven-hud/themes");

const jsonIn = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json"));

mkdirSync(dest, { recursive: true });
const wanted = jsonIn(src);
for (const f of wanted) copyFileSync(join(src, f), join(dest, f));
for (const f of jsonIn(dest)) if (!wanted.includes(f)) rmSync(join(dest, f));
console.log(`Synced ${wanted.length} themes to plugins/roadraven-hud/themes`);
