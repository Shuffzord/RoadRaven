// tests/release/install-script.test.ts
//
// Exercises install.sh end-to-end against a fake release served from a
// file:// directory (ROADRAVEN_BASE_URL): a tarball holding a stub `installer`
// plus a SHA256SUMS file, mirroring what release.yml's github-release job
// publishes. Linux-only, like the script itself.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "../../install.sh");
const ASSET = "linux-x64-RoadRaven-Setup.tar.gz";

describe.skipIf(process.platform !== "linux")("install.sh", () => {
	let release: string;
	let marker: string;

	beforeEach(() => {
		release = mkdtempSync(join(tmpdir(), "rr-install-test-"));
		marker = join(release, "installer-ran");
		writeFileSync(
			join(release, "installer"),
			'#!/bin/sh\necho ran > "$RR_STUB_MARKER"\n',
		);
		const tar = spawnSync("tar", ["-czf", ASSET, "installer"], {
			cwd: release,
		});
		expect(tar.status).toBe(0);
		rmSync(join(release, "installer"));
		const sha = createHash("sha256")
			.update(readFileSync(join(release, ASSET)))
			.digest("hex");
		writeFileSync(join(release, "SHA256SUMS"), `${sha}  ${ASSET}\n`);
	});

	afterEach(() => {
		rmSync(release, { recursive: true, force: true });
	});

	const run = () =>
		spawnSync("sh", [SCRIPT], {
			encoding: "utf-8",
			env: {
				...process.env,
				ROADRAVEN_BASE_URL: `file://${release}`,
				RR_STUB_MARKER: marker,
			},
		});

	it("verifies the checksum and runs the installer", () => {
		const result = run();
		expect(result.status, result.stderr).toBe(0);
		expect(existsSync(marker)).toBe(true);
	});

	it("refuses to run a download that does not match SHA256SUMS", () => {
		appendFileSync(join(release, ASSET), "tampered");
		const result = run();
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/checksum mismatch/);
		expect(existsSync(marker)).toBe(false);
	});

	it("refuses to run when SHA256SUMS does not list the installer", () => {
		writeFileSync(join(release, "SHA256SUMS"), "");
		const result = run();
		expect(result.status).not.toBe(0);
		expect(result.stderr).toMatch(/not listed in SHA256SUMS/);
		expect(existsSync(marker)).toBe(false);
	});
});
