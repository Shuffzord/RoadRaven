import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atomicWrite, isRetriableError } from "../../../src/bun/atomicWrite";
import * as renameModule from "../../../src/bun/renameSync";

describe("atomicWrite (EDIT-14)", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "rr-aw-test-"));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Windows may briefly hold handles
		}
	});

	it("writes content via tmp file and renames to target; no tmp remains", async () => {
		const target = join(tempDir, "out.json");
		await atomicWrite(target, '{"hello":"world"}');

		expect(existsSync(target)).toBe(true);
		expect(readFileSync(target, "utf-8")).toBe('{"hello":"world"}');

		// No .tmp file left behind (tmp is hidden with leading dot)
		const leftover = readdirSync(tempDir).filter((f) => f.includes(".tmp"));
		expect(leftover).toHaveLength(0);
	});

	it("writes successfully when target does not exist yet", async () => {
		const target = join(tempDir, "brand-new.json");
		expect(existsSync(target)).toBe(false);

		await atomicWrite(target, "fresh-content");

		expect(existsSync(target)).toBe(true);
		expect(readFileSync(target, "utf-8")).toBe("fresh-content");
	});

	it("overwrites existing target with new content", async () => {
		const target = join(tempDir, "existing.json");
		writeFileSync(target, "old-content", "utf-8");

		await atomicWrite(target, "new-content");

		expect(readFileSync(target, "utf-8")).toBe("new-content");
	});

	it("throws immediately on non-retriable ENOENT (parent dir missing); target not created", async () => {
		const bogusTarget = join(tempDir, "does-not-exist", "nested", "file.json");

		await expect(atomicWrite(bogusTarget, "x")).rejects.toThrow();

		// Directory never existed, so target cannot have been created
		expect(existsSync(bogusTarget)).toBe(false);
	});

	it("Windows retry: first rename fails with EPERM, second succeeds", async () => {
		const target = join(tempDir, "retry-success.json");
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", {
			value: "win32",
			configurable: true,
		});

		const realRename = renameModule.renameWithRetry;
		let calls = 0;
		const spy = vi
			.spyOn(renameModule, "renameWithRetry")
			.mockImplementation((from: string, to: string) => {
				calls++;
				if (calls === 1) {
					const err = new Error(
						"EPERM: operation not permitted",
					) as NodeJS.ErrnoException;
					err.code = "EPERM";
					throw err;
				}
				spy.mockRestore();
				return realRename(from, to);
			});

		try {
			await atomicWrite(target, "retried-content");
			expect(existsSync(target)).toBe(true);
			expect(readFileSync(target, "utf-8")).toBe("retried-content");
			// Mock intercepted two attempts: #1 threw EPERM, #2 delegated to real rename
			expect(calls).toBe(2);
		} finally {
			Object.defineProperty(process, "platform", {
				value: originalPlatform,
				configurable: true,
			});
		}
	});

	it("Windows retry: gives up after 3 attempts; final error is EPERM; tmp cleaned up", async () => {
		const target = join(tempDir, "retry-give-up.json");
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", {
			value: "win32",
			configurable: true,
		});

		let calls = 0;
		vi.spyOn(renameModule, "renameWithRetry").mockImplementation(() => {
			calls++;
			const err = new Error("EPERM locked") as NodeJS.ErrnoException;
			err.code = "EPERM";
			throw err;
		});

		try {
			await expect(atomicWrite(target, "unwritable")).rejects.toMatchObject({
				code: "EPERM",
			});
			expect(calls).toBe(3);

			const leftover = readdirSync(tempDir).filter((f) => f.includes(".tmp"));
			expect(leftover).toHaveLength(0);
		} finally {
			Object.defineProperty(process, "platform", {
				value: originalPlatform,
				configurable: true,
			});
		}
	});

	it("treats EEXIST as retriable on Windows", async () => {
		const target = join(tempDir, "eexist.json");
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", {
			value: "win32",
			configurable: true,
		});

		const realRename = renameModule.renameWithRetry;
		let calls = 0;
		const spy = vi
			.spyOn(renameModule, "renameWithRetry")
			.mockImplementation((from: string, to: string) => {
				calls++;
				if (calls === 1) {
					const err = new Error("EEXIST") as NodeJS.ErrnoException;
					err.code = "EEXIST";
					throw err;
				}
				spy.mockRestore();
				return realRename(from, to);
			});

		try {
			await atomicWrite(target, "eexist-handled");
			expect(existsSync(target)).toBe(true);
			// #1 threw EEXIST; #2 delegated to real rename → calls = 2
			expect(calls).toBe(2);
		} finally {
			Object.defineProperty(process, "platform", {
				value: originalPlatform,
				configurable: true,
			});
		}

		const err = new Error("x") as NodeJS.ErrnoException;
		err.code = "EEXIST";
		expect(isRetriableError(err)).toBe(true);
	});
});
