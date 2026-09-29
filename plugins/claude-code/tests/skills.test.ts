// Contract tests for the public skills shipped with the Claude Code plugin
// (plugins/claude-code/skills/<name>/SKILL.md). Claude Code scans that default
// directory and namespaces each skill as roadraven:<name>. These tests keep the
// skills generic, within budget, and honest about the tools the server
// actually registers.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(PLUGIN_ROOT, "skills");
const SERVER_TS = join(PLUGIN_ROOT, "src", "server.ts");

const EXPECTED_SKILLS = ["orchestrate", "work-node"];
const SKILL_MAX_LINES = 120;
const REFERENCE_MAX_LINES = 60;
const DESCRIPTION_MAX_CHARS = 1024;

// Terms that belong to the RoadRaven repository's own tooling. A public skill
// that mentions one of them is telling a stranger to run something they do
// not have. (One named constant; not exported, because biome's
// noExportsInTest rule rejects exports from test files.)
const FORBIDDEN_TERMS = [
	"bun",
	"vitest",
	"biome",
	"fallow",
	"Electrobun",
	"husky",
	"scripts/phase",
	"gates.ts",
	"check-report.ts",
	"rr-agent",
	"rr-phase",
	".hutch",
	"packages/desktop",
	"(retro:",
] as const;

function listSkillDirs(): string[] {
	const found = existsSync(SKILLS_DIR)
		? readdirSync(SKILLS_DIR, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
		: [];
	return [...new Set([...EXPECTED_SKILLS, ...found])].sort();
}

function referenceFiles(skill: string): string[] {
	const dir = join(SKILLS_DIR, skill, "references");
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".md"))
		.map((file) => join(dir, file));
}

function skillFiles(skill: string): string[] {
	return [join(SKILLS_DIR, skill, "SKILL.md"), ...referenceFiles(skill)];
}

function read(path: string): string {
	return readFileSync(path, "utf8");
}

function lineCount(text: string): number {
	return text.replace(/\n$/, "").split("\n").length;
}

function frontmatterField(text: string, field: string): string | undefined {
	const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
	const raw = new RegExp(`^${field}:[ \\t]*(.*)$`, "m").exec(block)?.[1];
	return raw?.trim().replace(/^(["'])(.*)\1$/, "$2");
}

function containsTerm(text: string, term: string): boolean {
	const escaped = term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
	return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`, "i").test(
		text,
	);
}

function toolCalls(text: string): string[] {
	return [...text.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)\(/g)].map((m) => m[1]);
}

function relativeLinks(text: string): string[] {
	return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
		.map((m) => m[1].split("#")[0])
		.filter((href) => href !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(href));
}

function registeredToolNames(): string[] {
	return [
		...read(SERVER_TS).matchAll(/server\.registerTool\(\s*"([^"]+)"/g),
	].map((m) => m[1]);
}

it("ships at least the orchestrate and work-node skills", () => {
	for (const skill of EXPECTED_SKILLS) {
		expect(existsSync(join(SKILLS_DIR, skill, "SKILL.md")), skill).toBe(true);
	}
});

it("orchestrate links its worklog fallback reference, which exists", () => {
	const reference = "references/worklog-fallback.md";
	const text = read(join(SKILLS_DIR, "orchestrate", "SKILL.md"));
	expect(text).toContain(`](${reference})`);
	expect(existsSync(join(SKILLS_DIR, "orchestrate", reference))).toBe(true);
});

describe.each(listSkillDirs())("skill %s", (skill) => {
	it("has frontmatter with name equal to its directory and a bounded description", () => {
		const text = read(join(SKILLS_DIR, skill, "SKILL.md"));
		expect(frontmatterField(text, "name")).toBe(skill);
		const description = frontmatterField(text, "description") ?? "";
		expect(description.length).toBeGreaterThan(0);
		expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
	});

	it("stays within the line budgets", () => {
		const skillMd = join(SKILLS_DIR, skill, "SKILL.md");
		expect(lineCount(read(skillMd))).toBeLessThanOrEqual(SKILL_MAX_LINES);
		for (const file of referenceFiles(skill)) {
			expect(lineCount(read(file)), file).toBeLessThanOrEqual(
				REFERENCE_MAX_LINES,
			);
		}
	});

	it("mentions none of the repository-internal terms", () => {
		for (const file of skillFiles(skill)) {
			const text = read(file);
			const leaks = FORBIDDEN_TERMS.filter((term) => containsTerm(text, term));
			expect(leaks, file).toEqual([]);
		}
	});

	it("names only tools the MCP server registers", () => {
		const registered = registeredToolNames();
		// Guard against the extraction silently matching nothing.
		expect(registered).toContain("createNode");
		expect(registered).toContain("updateNodeStatus");
		const called = skillFiles(skill).flatMap((file) => toolCalls(read(file)));
		expect(called.length).toBeGreaterThan(0);
		expect(called.filter((name) => !registered.includes(name))).toEqual([]);
	});

	it("never writes a tool name with an mcp__ prefix", () => {
		for (const file of skillFiles(skill)) {
			expect(read(file), file).not.toContain("mcp__");
		}
	});

	it("has relative links that resolve to existing files", () => {
		for (const file of skillFiles(skill)) {
			for (const href of relativeLinks(read(file))) {
				expect(
					existsSync(resolve(dirname(file), href)),
					`${file} -> ${href}`,
				).toBe(true);
			}
		}
	});
});
