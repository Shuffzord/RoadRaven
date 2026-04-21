/**
 * resolveRef path-traversal allowlist tests.
 *
 * `resolveRef` is an RPC entry point that reads arbitrary files from disk.
 * Without an allowlist, a crafted roadmap JSON with a $ref pointing outside
 * the loaded file's directory is a data-exfiltration primitive. The guard
 * mirrors the baseDir check already inside `resolveRefs` on the load path.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	isPathWithinMainDir,
	__resetSaveFileModuleForTests as reset,
	__setCachedMainPathForTests as setCachedMainPath,
} from "../../../src/bun/saveFile";

describe("isPathWithinMainDir (resolveRef allowlist)", () => {
	let tempDir: string;
	let mainPath: string;
	let baseDir: string;

	beforeEach(() => {
		reset();
		tempDir = mkdtempSync(join(tmpdir(), "resolve-ref-"));
		baseDir = join(tempDir, "roadmap");
		mkdirSync(baseDir, { recursive: true });
		mainPath = join(baseDir, "main.json");
		writeFileSync(mainPath, "{}");
		setCachedMainPath(mainPath);
	});

	afterEach(() => {
		reset();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("accepts a path inside the main file's directory", () => {
		expect(isPathWithinMainDir(join(baseDir, "child.json"))).toBe(true);
	});

	it("accepts a path in a nested subdirectory of the main file's dir", () => {
		expect(isPathWithinMainDir(join(baseDir, "sub", "nested.json"))).toBe(true);
	});

	it("accepts the base directory itself", () => {
		expect(isPathWithinMainDir(baseDir)).toBe(true);
	});

	it("rejects a sibling directory using ../ traversal", () => {
		// baseDir/../neighbor escapes out of baseDir
		const outside = join(baseDir, "..", "neighbor", "x.json");
		expect(isPathWithinMainDir(outside)).toBe(false);
	});

	it("rejects an unrelated absolute path", () => {
		const other = mkdtempSync(join(tmpdir(), "other-"));
		try {
			expect(isPathWithinMainDir(join(other, "x.json"))).toBe(false);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});

	it("rejects a path that merely shares a prefix string but is a sibling dir", () => {
		// e.g. baseDir = /tmp/xxx/roadmap, crafted = /tmp/xxx/roadmap-evil/x.json
		// startsWith(baseDir) would incorrectly pass without the separator check.
		const sibling = `${baseDir}-evil`;
		mkdirSync(sibling, { recursive: true });
		try {
			expect(isPathWithinMainDir(join(sibling, "x.json"))).toBe(false);
		} finally {
			rmSync(sibling, { recursive: true, force: true });
		}
	});

	it("rejects every path when no main file is cached", () => {
		reset();
		expect(isPathWithinMainDir(join(baseDir, "child.json"))).toBe(false);
	});

	it("normalizes relative segments before checking — baseDir + .. + basename escapes", () => {
		const tricky = join(baseDir, "sub", "..", "..", "outside", "x.json");
		expect(isPathWithinMainDir(tricky)).toBe(false);
	});
});

describe("isPathWithinMainDir — cross-platform separator handling", () => {
	it("handles forward-slash input on Windows by resolving through node:path", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "resolve-ref-slash-"));
		try {
			const main = join(tempDir, "main.json");
			writeFileSync(main, "{}");
			setCachedMainPath(main);
			const forwardSlash = `${dirname(main).replace(/\\/g, "/")}/child.json`;
			expect(isPathWithinMainDir(forwardSlash)).toBe(true);
		} finally {
			reset();
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
