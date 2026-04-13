import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");

describe("Tailwind v4 migration", () => {
	it("postcss.config.js does not exist (deleted per Pitfall 1)", () => {
		expect(existsSync(resolve(root, "postcss.config.js"))).toBe(false);
	});

	it("tailwind.config.js does not exist (replaced by CSS-first @theme)", () => {
		expect(existsSync(resolve(root, "tailwind.config.js"))).toBe(false);
	});

	it("vite.config.ts imports @tailwindcss/vite", () => {
		const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf-8");
		expect(viteConfig).toContain('from "@tailwindcss/vite"');
	});

	it("vite.config.ts uses tailwindcss() in plugins", () => {
		const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf-8");
		expect(viteConfig).toMatch(/plugins:\s*\[.*tailwindcss\(\)/s);
	});
});

describe("index.css token system", () => {
	const css = () =>
		readFileSync(resolve(root, "src/mainview/index.css"), "utf-8");

	it("contains @import 'tailwindcss' directive", () => {
		expect(css()).toMatch(/@import\s+["']tailwindcss["']/);
	});

	it("contains @theme block with --color-rv-bg-base entry", () => {
		expect(css()).toContain("@theme");
		expect(css()).toContain("--color-rv-bg-base: var(--rv-bg-base)");
	});

	it("dark theme [data-theme='dark'] block contains --rv-bg-base: #131313", () => {
		const content = css();
		const darkBlock = extractThemeBlock(content, "dark");
		expect(darkBlock).toContain("--rv-bg-base: #131313");
	});

	it("light theme [data-theme='light'] block contains --rv-bg-base: #ffffff", () => {
		const content = css();
		const lightBlock = extractThemeBlock(content, "light");
		expect(lightBlock).toContain("--rv-bg-base: #ffffff");
	});

	it("high contrast [data-theme='high-contrast'] block contains --rv-bg-base: #000000", () => {
		const content = css();
		const hcBlock = extractThemeBlock(content, "high-contrast");
		expect(hcBlock).toContain("--rv-bg-base: #000000");
	});

	it("all 40+ tokens present in each theme block", () => {
		const content = css();
		const requiredTokens = [
			"--rv-bg-base",
			"--rv-bg-canvas",
			"--rv-bg-surface",
			"--rv-bg-node",
			"--rv-bg-input",
			"--rv-bg-statusbar",
			"--rv-bg-elevated",
			"--rv-bg-hover",
			"--rv-bg-active",
			"--rv-bg-node-hover",
			"--rv-bg-toolbar",
			"--rv-bg-panel",
			"--rv-bg-config",
			"--rv-text-primary",
			"--rv-text-secondary",
			"--rv-text-tertiary",
			"--rv-text-on-accent",
			"--rv-border:",
			"--rv-border-subtle",
			"--rv-border-focus",
			"--rv-accent:",
			"--rv-accent-hover",
			"--rv-accent-muted",
			"--rv-accent-border",
			"--rv-dot-grid",
			"--rv-line-connector",
			"--rv-shadow-node:",
			"--rv-shadow-node-hover",
			"--rv-shadow-panel",
			"--rv-shadow-config",
			"--rv-scrollbar-track",
			"--rv-scrollbar-thumb",
			"--rv-border-width",
			"--rv-status-not-started:",
			"--rv-status-not-started-bg",
			"--rv-status-in-progress:",
			"--rv-status-in-progress-bg",
			"--rv-status-completed:",
			"--rv-status-completed-bg",
			"--rv-status-blocked:",
			"--rv-status-blocked-bg",
		];

		for (const theme of ["dark", "light", "high-contrast"]) {
			const block = extractThemeBlock(content, theme);
			for (const token of requiredTokens) {
				expect(
					block,
					`Missing ${token} in ${theme} theme`,
				).toContain(token);
			}
		}
	});
});

describe("vitest.config.ts", () => {
	it("has environmentMatchGlobs for jsdom", () => {
		const config = readFileSync(resolve(root, "vitest.config.ts"), "utf-8");
		expect(config).toContain("environmentMatchGlobs");
		expect(config).toContain("jsdom");
	});
});

describe("shared/types.ts RPC types", () => {
	it("has saveSettings and loadSettings RPC request types", () => {
		const types = readFileSync(
			resolve(root, "../../shared/types.ts"),
			"utf-8",
		);
		expect(types).toContain("saveSettings");
		expect(types).toContain("loadSettings");
	});
});

/** Extract a [data-theme="X"] block from CSS content */
function extractThemeBlock(css: string, theme: string): string {
	const regex = new RegExp(
		`\\[data-theme="${theme}"\\]\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
		"s",
	);
	const match = css.match(regex);
	return match?.[0] ?? "";
}
