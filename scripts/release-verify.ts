// scripts/release-verify.ts
// Usage: bun scripts/release-verify.ts [version]
//
// Read-only post-release check over public HTTP. Prints PASS/FAIL per check
// with a one-line fix hint; exits 1 on any FAIL. Default version is
// packages/desktop/package.json's.
import { readFileSync } from "node:fs";

const version =
	process.argv[2] ??
	JSON.parse(readFileSync("packages/desktop/package.json", "utf8")).version;
const REPO = "Shuffzord/RoadRaven";
const RAW = `https://raw.githubusercontent.com/${REPO}/master`;

// Asset names as shipped by v0.8.8 (patches are optional and not checked).
const expectedAssets = [
	"linux-x64-RoadRaven-Setup.tar.gz",
	"SHA256SUMS",
	"stable-linux-x64-RoadRaven.tar.zst",
	"stable-linux-x64-update.json",
	"stable-win-x64-RoadRaven.tar.zst",
	"stable-win-x64-update.json",
	"win-x64-RoadRaven-Setup.zip",
];

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// biome-ignore lint/suspicious/noExplicitAny: ad-hoc remote JSON
async function getJson(url: string): Promise<any> {
	const res = await fetch(url, {
		headers: {
			"user-agent": "release-verify",
			...(TOKEN && { authorization: `Bearer ${TOKEN}` }),
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
	return res.json();
}

// A check returns null on success or a "problem | fix hint" string.
const checks: [string, () => Promise<string | null>][] = [
	[
		"GitHub release",
		async () => {
			const r = await getJson(
				`https://api.github.com/repos/${REPO}/releases/tags/v${version}`,
			);
			if (r.draft) return "release is a draft | publish it on GitHub";
			const have = new Set(r.assets.map((a: { name: string }) => a.name));
			const missing = expectedAssets.filter((a) => !have.has(a));
			return missing.length
				? `missing assets: ${missing.join(", ")} | check the Release workflow run, re-run failed jobs`
				: null;
		},
	],
	[
		"npm @roadraven/mcp",
		async () => {
			const r = await getJson("https://registry.npmjs.org/@roadraven/mcp");
			const latest = r["dist-tags"]?.latest;
			return latest === version
				? null
				: `latest is ${latest} | staged but not approved? run npm stage approve <id> (id in the release run's 'Publish @roadraven/mcp' log)`;
		},
	],
	[
		"MCP Registry",
		async () => {
			const r = await getJson(
				"https://registry.modelcontextprotocol.io/v0/servers?search=io.github.Shuffzord/roadraven",
			);
			const e = r.servers?.find(
				// biome-ignore lint/suspicious/noExplicitAny: ad-hoc remote JSON
				(s: any) =>
					(s.server ?? s).name === "io.github.Shuffzord/roadraven" &&
					(s.server ?? s).version === version,
			);
			if (!e) return `no entry at ${version} | run: mcp-publisher login github && mcp-publisher publish (from plugins/claude-code)`;
			return e._meta?.["io.modelcontextprotocol.registry/official"]?.isLatest
				? null
				: "entry is not isLatest | re-run mcp-publisher publish from plugins/claude-code";
		},
	],
	[
		"Marketplace on master",
		async () => {
			const m = await getJson(`${RAW}/.claude-plugin/marketplace.json`);
			const bad = ["roadraven", "roadraven-hud"].filter(
				// biome-ignore lint/suspicious/noExplicitAny: ad-hoc remote JSON
				(n) => m.plugins?.find((p: any) => p.name === n)?.version !== version,
			);
			if (bad.length)
				return `${bad.join(", ")} not at ${version} | merge the release PR; raw.githubusercontent caches up to 5 min`;
			const mcp = await (await fetch(`${RAW}/plugins/claude-code/.mcp.json`)).text();
			return mcp.includes(`@roadraven/mcp@${version}"`)
				? null
				: `.mcp.json does not pin @roadraven/mcp@${version} | run bump-version.ts and merge`;
		},
	],
];

let failed = 0;
for (const [name, run] of checks) {
	let problem: string | null;
	try {
		problem = await run();
	} catch (e) {
		problem = `${(e as Error).message} | retry; check network`;
	}
	if (problem) failed++;
	console.log(`${problem ? "FAIL" : "PASS"} ${name}${problem ? `: ${problem}` : ""}`);
}
console.log(failed ? `\n${failed} check(s) failed for v${version}` : `\nv${version} verified`);
process.exit(failed ? 1 : 0);
