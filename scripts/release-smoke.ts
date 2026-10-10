// scripts/release-smoke.ts
// Usage: bun scripts/release-smoke.ts [--from <tag>]
//
// Pre-tag check that runs the Claude Code plugin install and UPGRADE paths
// for real with the `claude` CLI, so a release can't claim an upgrade path
// nobody ran (0.8.8: existing plugin users never got roadraven-hud).
// Run from the repo root. Every `claude` call gets CLAUDE_CONFIG_DIR set to
// a fresh temp dir — the user's real ~/.claude is never touched.
//
// 1. fresh install: the working tree as a local marketplace, install
//    roadraven@roadraven, expect roadraven + roadraven-hud at the current
//    version and no errors in `plugin list --json`.
// 2. upgrade: a worktree of the previous release tag as the marketplace,
//    install, move the worktree to HEAD, run the app's `update-plugin`
//    remedy (parsed from EventToast.tsx) verbatim, expect the same as (1).
// 3. MCP pin: plugins/claude-code/.mcp.json pins @roadraven/mcp@<version>.
//
// Installed versions come from installed_plugins.json: for local-path
// marketplaces `plugin list` reports the live folder version instead.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PLUGINS = ["roadraven@roadraven", "roadraven-hud@roadraven"];
const version: string = JSON.parse(readFileSync("packages/desktop/package.json", "utf8")).version;
// The upgrade check moves a worktree to the committed HEAD, so an uncommitted
// version bump would test the old version: refuse instead of a false FAIL.
const headVersion: string = JSON.parse(
	Bun.spawnSync(["git", "show", "HEAD:packages/desktop/package.json"]).stdout.toString(),
).version;
if (headVersion !== version) {
	console.error(`Working tree is at ${version} but HEAD is at ${headVersion}: commit the version bump first.`);
	process.exit(1);
}
const fromIdx = process.argv.indexOf("--from");
const fromArg = fromIdx > -1 ? process.argv[fromIdx + 1] : undefined;
const temps: string[] = [];
const worktrees: string[] = [];
const results: { name: string; status: "PASS" | "FAIL" | "SKIP"; detail: string }[] = [];

function sh(cmd: string[], env: Record<string, string> = {}, cwd = "."): string {
	const p = Bun.spawnSync(cmd, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
	const out = p.stdout.toString() + p.stderr.toString();
	if (p.exitCode !== 0) throw new Error(`\`${cmd.join(" ")}\` exited ${p.exitCode}: ${out.trim()}`);
	return out;
}

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	temps.push(dir);
	return dir;
}

// A fresh, verified-empty Claude config dir.
function isolatedConfig(): Record<string, string> {
	const env = { CLAUDE_CONFIG_DIR: tempDir("rr-smoke-claude-") };
	const list = sh(["claude", "plugin", "list", "--json"], env);
	let installed: unknown;
	try {
		installed = JSON.parse(list);
	} catch {}
	if (!Array.isArray(installed) || installed.length) throw new Error(`isolation check failed, CLAUDE_CONFIG_DIR not honoured: ${list.trim()}`);
	return env;
}

function installedVersions(env: Record<string, string>): Record<string, string | undefined> {
	const file = JSON.parse(readFileSync(join(env.CLAUDE_CONFIG_DIR, "plugins/installed_plugins.json"), "utf8"));
	return Object.fromEntries(PLUGINS.map((id) => [id, file.plugins[id]?.[0]?.version]));
}

// Throws unless every plugin is installed at `want` and `plugin list --json` has no errors.
function assertInstalled(env: Record<string, string>, want: string, ids = PLUGINS): void {
	const got = installedVersions(env);
	const wrong = ids.filter((id) => got[id] !== want);
	if (wrong.length) throw new Error(`expected ${want}, got ${wrong.map((id) => `${id}=${got[id] ?? "missing"}`).join(", ")}`);
	const list: Record<string, unknown>[] = JSON.parse(sh(["claude", "plugin", "list", "--json"], env));
	const errors = list.flatMap((p) => Object.entries(p).filter(([k, v]) => /error/i.test(k) && v && (!Array.isArray(v) || v.length)).map(([, v]) => `${p.id}: ${JSON.stringify(v)}`));
	if (errors.length) throw new Error(`plugin list errors: ${errors.join("; ")}`);
}

function install(env: Record<string, string>, marketplace: string): void {
	sh(["claude", "plugin", "marketplace", "add", marketplace], env);
	sh(["claude", "plugin", "install", "roadraven@roadraven", "--json", "-y"], env);
}

function check(name: string, fn: () => string): void {
	try {
		results.push({ name, status: "PASS", detail: fn() });
	} catch (e) {
		const msg = (e as Error).message;
		results.push({ name, status: msg.startsWith("skipped:") ? "SKIP" : "FAIL", detail: msg });
	}
}

function freshInstall(): string {
	const env = isolatedConfig();
	install(env, process.cwd());
	assertInstalled(env, version);
	return `roadraven + roadraven-hud at ${version}`;
}

function previousTag(): string {
	if (fromArg) return fromArg;
	const newest = sh(["git", "tag", "--merged", "HEAD", "-l", "v*.*.*", "--sort=-v:refname"]).split("\n")[0]?.trim();
	if (!newest || newest === `v${version}`) throw new Error("skipped: no older release than the current version (pass --from <tag>)");
	return newest;
}

// The exact commands the app's update-plugin toast tells the user to paste.
// Parsed naively (split on ";" then whitespace): the toast's commands must stay
// free of quotes and of ";" inside arguments.
function remedyCommands(): string[] {
	const src = readFileSync("packages/desktop/src/mainview/components/EventToast.tsx", "utf8");
	const m = src.match(/"update-plugin":[\s\S]*?command:\s*"([^"]+)"/);
	if (!m) throw new Error("update-plugin command not found in EventToast.tsx");
	return m[1].split(";").map((c) => c.trim()).filter(Boolean);
}

function upgrade(): string {
	const tag = previousTag();
	const head = sh(["git", "rev-parse", "HEAD"]).trim();
	const wt = join(tempDir("rr-smoke-wt-"), "repo");
	sh(["git", "worktree", "add", "--detach", wt, tag]);
	worktrees.push(wt);
	const oldVersion = JSON.parse(readFileSync(join(wt, "packages/desktop/package.json"), "utf8")).version;
	const env = isolatedConfig();
	install(env, wt);
	assertInstalled(env, oldVersion, ["roadraven@roadraven"]);
	sh(["git", "-C", wt, "checkout", "--detach", head]);
	const ran: string[] = [];
	for (const cmd of remedyCommands()) {
		// Like a pasted `a; b; c`: a failing step does not stop the rest.
		try {
			sh(cmd.split(/\s+/), env);
			ran.push(`ok: ${cmd}`);
		} catch (e) {
			ran.push(`FAILED: ${(e as Error).message}`);
		}
	}
	try {
		assertInstalled(env, version);
	} catch (e) {
		throw new Error(`${(e as Error).message}\n    remedy:\n      ${ran.join("\n      ")}`);
	}
	return `${tag} (${oldVersion}) -> HEAD (${version}) via ${ran.length} remedy commands`;
}

function mcpPin(): string {
	const pin = `@roadraven/mcp@${version}`;
	if (!readFileSync("plugins/claude-code/.mcp.json", "utf8").includes(`"${pin}"`)) throw new Error(`plugins/claude-code/.mcp.json does not pin ${pin}`);
	return pin;
}

try {
	check("fresh install", freshInstall);
	check("upgrade", upgrade);
	check("mcp pin", mcpPin);
} finally {
	for (const wt of worktrees) Bun.spawnSync(["git", "worktree", "remove", "--force", wt]);
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
}

for (const r of results) console.log(`${r.status}  ${r.name}: ${r.detail}`);
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
