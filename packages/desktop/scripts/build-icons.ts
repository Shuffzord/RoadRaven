import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pngToIco from "png-to-ico";

const SRC_PNG = resolve(
	import.meta.dir,
	"../src/mainview/assets/raven-logo.png",
);
const OUT_DIR = resolve(import.meta.dir, "../assets");
const OUT_PNG = resolve(OUT_DIR, "icon.png");
const OUT_ICO = resolve(OUT_DIR, "icon.ico");

if (!existsSync(SRC_PNG)) {
	throw new Error(`source not found: ${SRC_PNG}`);
}

await mkdir(OUT_DIR, { recursive: true });
await copyFile(SRC_PNG, OUT_PNG);

const ico = await pngToIco(SRC_PNG);
await writeFile(OUT_ICO, ico);
