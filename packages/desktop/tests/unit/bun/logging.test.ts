// v0.8.5 Phase 3 (R2/Phase 0 "Noticed"): rotate the previous session's log to
// `.1` before opening a fresh writer, so an auto-update relaunch (or any
// relaunch) does not erase the log of the session that just ran.

import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getLogger, reset } from "@logtape/logtape";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	rotateLogFile,
	serverLogger,
	setupBunLogging,
} from "../../../src/bun/logging";
import * as renameModule from "../../../src/bun/renameSync";

describe("rotateLogFile", () => {
	let tempDir: string;
	let logPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "rr-log-rotate-test-"));
		logPath = join(tempDir, "roadraven.log");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Windows may briefly hold handles
		}
	});

	it("renames an existing log to .1", () => {
		writeFileSync(logPath, "previous session\n", "utf-8");

		rotateLogFile(logPath);

		expect(existsSync(logPath)).toBe(false);
		expect(existsSync(`${logPath}.1`)).toBe(true);
		expect(readFileSync(`${logPath}.1`, "utf-8")).toBe("previous session\n");
	});

	it("overwrites an older .1", () => {
		writeFileSync(`${logPath}.1`, "stale\n", "utf-8");
		writeFileSync(logPath, "newest session\n", "utf-8");

		rotateLogFile(logPath);

		expect(existsSync(logPath)).toBe(false);
		expect(readFileSync(`${logPath}.1`, "utf-8")).toBe("newest session\n");
	});

	it("is a no-op when nothing exists", () => {
		expect(existsSync(logPath)).toBe(false);

		expect(() => rotateLogFile(logPath)).not.toThrow();

		expect(existsSync(logPath)).toBe(false);
		expect(existsSync(`${logPath}.1`)).toBe(false);
	});

	it("does not throw when the rename fails (log directory read-only — simulate with a missing parent)", () => {
		writeFileSync(logPath, "previous session\n", "utf-8");
		vi.spyOn(renameModule, "renameWithRetry").mockImplementation(() => {
			const err = new Error(
				"ENOENT: no such file or directory",
			) as NodeJS.ErrnoException;
			err.code = "ENOENT";
			throw err;
		});

		expect(() => rotateLogFile(logPath)).not.toThrow();
		// Original file is untouched since the rename failed.
		expect(existsSync(logPath)).toBe(true);
	});
});

describe("setupBunLogging", () => {
	afterEach(async () => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		await reset();
	});

	it("routes roadraven.* categories (server, agent) to the file sink", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "rr-log-setup-test-"));
		vi.stubEnv("XDG_DATA_HOME", tempDir);
		vi.stubEnv("LOCALAPPDATA", tempDir);
		vi.stubEnv("HOME", tempDir);
		const written: string[] = [];
		vi.stubGlobal("Bun", {
			file: () => ({
				writer: () => ({
					write: (c: Uint8Array | string) =>
						written.push(
							typeof c === "string" ? c : new TextDecoder().decode(c),
						),
					flush: () => undefined,
				}),
			}),
		});

		await setupBunLogging();
		serverLogger.info("Hello frame version=1");
		getLogger(["roadraven", "agent"]).info("agent request ok");

		await new Promise((r) => setTimeout(r, 20)); // stream sink writes async
		const out = written.join("");
		expect(out).toContain("Hello frame version=1");
		expect(out).toContain("agent request ok");
		rmSync(tempDir, { recursive: true, force: true });
	});
});
