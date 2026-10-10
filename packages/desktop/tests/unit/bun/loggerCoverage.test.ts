// Guard: a getLogger category with no configured logger is silently dropped
// (0.8.8 shipped ["roadraven", ...] loggers that wrote nowhere).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGGER_CONFIGS } from "../../../src/bun/logging";

const SRC = join(__dirname, "../../../src");
// Mainview has its own LogTape config that forwards over RPC; the bun
// logMessage handler re-emits it under the same ["webview", ...] category.
const DIRS = [join(SRC, "bun"), join(SRC, "mainview")];
// index.ts logMessage forwards webview categories via getLogger(category).
const DYNAMIC_ALLOWED = ["bun/index.ts"];

function tsFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		if (e.isDirectory()) return tsFiles(p);
		return /\.tsx?$/.test(e.name) ? [p] : [];
	});
}

const found: { file: string; category: string[] }[] = [];
const unparseable: string[] = [];
for (const file of DIRS.flatMap(tsFiles)) {
	const rel = relative(SRC, file).replaceAll("\\", "/");
	const text = readFileSync(file, "utf-8");
	for (const m of text.matchAll(/\bgetLogger\s*\(([^)]*)\)/g)) {
		const arg = m[1].trim();
		const lit = /^\[\s*((?:(["'])[^"']*\2\s*,?\s*)+)\]$/.exec(arg);
		if (lit) {
			const category = [...lit[1].matchAll(/(["'])([^"']*)\1/g)].map(
				(x) => x[2],
			);
			found.push({ file: rel, category });
		} else if (!DYNAMIC_ALLOWED.includes(rel)) {
			unparseable.push(`${rel}: getLogger(${arg})`);
		}
	}
}

describe("logger coverage", () => {
	it("every getLogger call has a literal category (or is allow-listed)", () => {
		expect(unparseable).toEqual([]);
	});

	it("finds loggers to check", () => {
		expect(found.length).toBeGreaterThan(0);
	});

	it.each(
		found.map((f) => [f.file, f.category.join(".")]),
	)("%s category %s has a configured logger", (file, cat) => {
		const category = cat.split(".");
		// LogTape accepts a category as a string or a segment array.
		const ok = LOGGER_CONFIGS.some((c) =>
			[c.category].flat().every((seg, i) => category[i] === seg),
		);
		expect(ok, `${file}: no configured logger for [${category}]`).toBe(true);
	});
});
