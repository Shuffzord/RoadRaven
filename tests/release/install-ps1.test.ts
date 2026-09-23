// tests/release/install-ps1.test.ts
//
// Exercises install.ps1 end-to-end against a fake release served over HTTP on
// 127.0.0.1 (ROADRAVEN_BASE_URL; PowerShell 7 cannot download file:// URLs): a
// zip holding a stub RoadRaven-Setup.exe plus its .installer\ folder, and a
// SHA256SUMS file, mirroring what release.yml's github-release job publishes.
// The script itself is fetched and run with `irm | iex`, as users do, under
// Windows PowerShell 5.1 and, when installed, PowerShell 7. Windows-only, like
// the script itself.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";

const SCRIPT = resolve(__dirname, "../../install.ps1");
const ASSET = "win-x64-RoadRaven-Setup.zip";

// Windows PowerShell 5.1 is what `irm | iex` runs in by default; PowerShell 7
// is covered too when it is installed.
const HOSTS = ["powershell.exe"];
if (spawnSync("where.exe", ["pwsh"]).status === 0) HOSTS.push("pwsh");

// A real GUI-subsystem PE like RoadRaven-Setup.exe, built with the .NET
// Framework compiler that ships with Windows. Like the real one it refuses to
// run without .installer\ beside it and, once done, leaves a process behind
// (the real one launches the app when the user clicks Close). The sleep means
// the marker only exists if install.ps1 waited for Setup.exe; the ~60s ping
// outlasts the test timeout if it also waited for Setup.exe's children.
// RR_STUB_FAIL makes it exit non-zero instead.
const STUB = `
using System; using System.Diagnostics; using System.IO; using System.Threading;
class Stub {
	static int Main() {
		if (!Directory.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".installer"))) return 2;
		if (Environment.GetEnvironmentVariable("RR_STUB_FAIL") != null) return 3;
		Thread.Sleep(1000);
		File.WriteAllText(Environment.GetEnvironmentVariable("RR_STUB_MARKER"), "ran");
		Process.Start(new ProcessStartInfo("ping.exe", "-n 61 127.0.0.1") {
			UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Environment.SystemDirectory });
		return 0;
	}
}`;

describe.skipIf(process.platform !== "win32")("install.ps1", () => {
	let zip: Buffer;
	let sha: string;
	let server: Server;
	let base: string;
	let release: string;
	let marker: string;

	beforeAll(async () => {
		const fixture = mkdtempSync(join(tmpdir(), "rr-install-ps1-fixture-"));
		writeFileSync(join(fixture, "stub.cs"), STUB);
		const csc = spawnSync(
			`${process.env.SystemRoot}\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe`,
			["-nologo", "-target:winexe", "-out:RoadRaven-Setup.exe", "stub.cs"],
			{ cwd: fixture, encoding: "utf-8" },
		);
		expect(csc.status, csc.stdout).toBe(0);
		mkdirSync(join(fixture, ".installer"));
		writeFileSync(
			join(fixture, ".installer", "RoadRaven-Setup.metadata.json"),
			"{}",
		);
		// Windows' own bsdtar writes zips (-a picks the format from the
		// extension); a GNU tar earlier on PATH (Git Bash) would not.
		const tar = spawnSync(
			`${process.env.SystemRoot}\\System32\\tar.exe`,
			["-a", "-cf", ASSET, "RoadRaven-Setup.exe", ".installer"],
			{ cwd: fixture, encoding: "utf-8" },
		);
		expect(tar.status, tar.stderr).toBe(0);
		zip = readFileSync(join(fixture, ASSET));
		sha = createHash("sha256").update(zip).digest("hex");
		rmSync(fixture, { recursive: true, force: true });

		server = createServer((req, res) => {
			const file =
				req.url === "/install.ps1" ? SCRIPT : join(release, req.url ?? "");
			if (existsSync(file)) {
				// raw.githubusercontent.com serves the script as UTF-8 text too.
				res
					.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
					.end(readFileSync(file));
			} else {
				res.writeHead(404).end();
			}
		});
		await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}, 60_000);

	afterAll(() => {
		server?.close();
	});

	beforeEach(() => {
		release = mkdtempSync(join(tmpdir(), "rr-install-ps1-test-"));
		marker = join(release, "installer-ran");
		writeFileSync(join(release, ASSET), zip);
		writeFileSync(
			join(release, "SHA256SUMS"),
			`${"0".repeat(64)}  linux-x64-RoadRaven-Setup.tar.gz\n${sha}  ${ASSET}\n`,
		);
	});

	afterEach(() => {
		rmSync(release, { recursive: true, force: true });
	});

	// Fed through stdin, the two lines run one at a time like a user's prompt:
	// the second only runs if install.ps1 left the session open (`exit` under
	// `iex` would close the user's window), and reports whether the install
	// failed and whether the script leaked its preferences into the session.
	const run = (host: string, env: Record<string, string> = {}) =>
		new Promise<{ stdout: string; stderr: string }>((done) => {
			// Start like a fresh window: a PSModulePath inherited from a PowerShell
			// 7 parent (CI steps run in pwsh) hides 5.1's own modules, and with
			// them Get-FileHash. Env names ignore case on Windows, and under bunx
			// this one arrives upper-cased.
			const inherited = Object.fromEntries(
				Object.entries(process.env).filter(
					([name]) => name.toUpperCase() !== "PSMODULEPATH",
				),
			);
			const child = spawn(
				host,
				["-NoProfile", "-NonInteractive", "-Command", "-"],
				{
					env: {
						...inherited,
						ROADRAVEN_BASE_URL: base,
						RR_STUB_MARKER: marker,
						NO_COLOR: "1",
						...env,
					},
				},
			);
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			child.on("close", () => done({ stdout, stderr }));
			child.stdin.end(
				`irm ${base}/install.ps1 | iex\n"session ok=$? eap=$ErrorActionPreference progress=$ProgressPreference"\n`,
			);
		});

	// A failed install leaves the session open, says why on stderr, and never
	// gets as far as the stub's marker.
	const expectFailure = async (
		host: string,
		reason: RegExp,
		env: Record<string, string> = {},
	) => {
		const result = await run(host, env);
		expect(result.stdout).toContain("session ok=False eap=Continue");
		expect(result.stderr).toMatch(reason);
		expect(existsSync(marker)).toBe(false);
	};

	describe.each(HOSTS)("under %s", (host) => {
		it("verifies the checksum and runs the installer", async () => {
			const result = await run(host);
			expect(result.stdout, result.stderr).toContain(
				"session ok=True eap=Continue progress=Continue",
			);
			expect(existsSync(marker)).toBe(true);
		}, 30_000);

		it("refuses to run a download that does not match SHA256SUMS", async () => {
			appendFileSync(join(release, ASSET), "tampered");
			await expectFailure(host, /checksum mismatch/);
		}, 30_000);

		it("refuses to run when SHA256SUMS does not list the installer", async () => {
			// Near misses carrying the right hash: only an exact name counts.
			writeFileSync(
				join(release, "SHA256SUMS"),
				`${sha}  ${ASSET}.sig\n${sha}  old-${ASSET}\n`,
			);
			await expectFailure(host, /not listed in SHA256SUMS/);
		}, 30_000);

		it("fails when the installer exits non-zero", async () => {
			await expectFailure(host, /RoadRaven-Setup\.exe failed \(exit code 3\)/, {
				RR_STUB_FAIL: "1",
			});
		}, 30_000);
	});
});
