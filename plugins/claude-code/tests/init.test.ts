import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	applySnippet,
	askInitChoices,
	CLAUDE_MD_SNIPPET,
	parseInitArgs,
	resolveClaudeMdPath,
	writeSnippet,
} from "../src/init";

describe("resolveClaudeMdPath", () => {
	it("project level is ./CLAUDE.md in cwd", () => {
		expect(resolveClaudeMdPath("project", "/repo", "/home/u")).toBe(
			join("/repo", "CLAUDE.md"),
		);
	});

	it("user level is ~/.claude/CLAUDE.md", () => {
		expect(resolveClaudeMdPath("user", "/repo", "/home/u")).toBe(
			join("/home/u", ".claude", "CLAUDE.md"),
		);
	});
});

describe("applySnippet", () => {
	it("returns just the snippet for a missing or empty file", () => {
		expect(applySnippet(undefined)).toBe(CLAUDE_MD_SNIPPET);
		expect(applySnippet("")).toBe(CLAUDE_MD_SNIPPET);
	});

	it("appends after existing content with a blank line, keeping it intact", () => {
		const existing = "# My project\n\nSome rules.\n";
		const out = applySnippet(existing);
		expect(out.startsWith(existing)).toBe(true);
		expect(out).toBe(`${existing}\n${CLAUDE_MD_SNIPPET}`);
	});

	it("is idempotent: applying twice yields the same content", () => {
		const once = applySnippet("# My project\n");
		expect(applySnippet(once)).toBe(once);
	});

	it("replaces a stale marked block in place and keeps text around it", () => {
		const stale =
			"# Top\n\n<!-- roadraven:start -->\nold text\n<!-- roadraven:end -->\n\n## Below\n";
		const out = applySnippet(stale);
		expect(out).not.toContain("old text");
		expect(out.startsWith("# Top\n\n<!-- roadraven:start -->")).toBe(true);
		expect(out.endsWith("<!-- roadraven:end -->\n\n## Below\n")).toBe(true);
		expect(out.match(/roadraven:start/g)).toHaveLength(1);
	});
});

describe("writeSnippet", () => {
	let dir: string;
	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	it("creates the file and parent directory when missing", () => {
		dir = mkdtempSync(join(tmpdir(), "rr-init-"));
		const path = join(dir, ".claude", "CLAUDE.md");
		expect(writeSnippet(path)).toBe("created");
		expect(readFileSync(path, "utf8")).toBe(CLAUDE_MD_SNIPPET);
	});

	it("appends to an existing file, then updates on a second run", () => {
		dir = mkdtempSync(join(tmpdir(), "rr-init-"));
		const path = join(dir, "CLAUDE.md");
		writeFileSync(path, "# Rules\n", "utf8");
		expect(writeSnippet(path)).toBe("appended");
		expect(writeSnippet(path)).toBe("updated");
		const content = readFileSync(path, "utf8");
		expect(content.startsWith("# Rules\n")).toBe(true);
		expect(content.match(/roadraven:start/g)).toHaveLength(1);
	});
});

describe("parseInitArgs", () => {
	it("reads --yes and --level", () => {
		expect(parseInitArgs(["--level", "user", "--yes"])).toEqual({
			yes: true,
			level: "user",
		});
		expect(parseInitArgs([])).toEqual({ yes: false, level: undefined });
	});

	it("ignores an invalid --level value", () => {
		expect(parseInitArgs(["--level", "global"]).level).toBeUndefined();
	});
});

describe("askInitChoices", () => {
	const scripted = (...answers: string[]) => ({
		question: async () => answers.shift() ?? "",
	});

	it("returns undefined when the user declines", async () => {
		expect(await askInitChoices(scripted("n"), { yes: false })).toBeUndefined();
	});

	it("defaults to project on Enter and accepts 'u' for user", async () => {
		expect(await askInitChoices(scripted("", ""), { yes: false })).toBe(
			"project",
		);
		expect(await askInitChoices(scripted("y", "u"), { yes: false })).toBe(
			"user",
		);
	});

	it("skips the confirmation with --yes and keeps a given level", async () => {
		expect(await askInitChoices(scripted(), { yes: true, level: "user" })).toBe(
			"user",
		);
	});
});
