import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("Tailwind v4 migration", () => {
	// Guards against accidentally re-introducing Tailwind v3 config files.
	// Tailwind v4 uses CSS-first @theme blocks instead of JS config.
	it("postcss.config.js does not exist (deleted per Pitfall 1)", () => {
		expect(existsSync(resolve(root, "postcss.config.js"))).toBe(false);
	});

	it("tailwind.config.js does not exist (replaced by CSS-first @theme)", () => {
		expect(existsSync(resolve(root, "tailwind.config.js"))).toBe(false);
	});
});

describe("index.css token system", () => {
	const css = () =>
		readFileSync(resolve(root, "src/mainview/index.css"), "utf-8");

	// NOTE: The @import "tailwindcss" directive check was removed because the
	// Vite build smoke test (tests/integration/build.test.ts) catches missing
	// or misordered imports more reliably than string matching.

	it("contains @theme block with --color-rv-bg-base entry", () => {
		expect(css()).toContain("@theme");
		expect(css()).toContain("--color-rv-bg-base: var(--rv-bg-base)");
	});

	// v0.8.3 Phase 3 (RC2): themes are data. The token values live in
	// src/mainview/themes/*.json and are painted onto :root by applyTheme;
	// index.css keeps the @theme bridge and the global rules only. A
	// [data-theme] selector or a hex colour outside the bridge is a theme
	// value that has crept back into CSS.
	it("has no [data-theme] selector", () => {
		expect(css().match(/\[data-theme=/g) ?? []).toEqual([]);
	});

	it("has no colour literal outside the @theme bridge", () => {
		const content = css().replace(/\/\*[\s\S]*?\*\//g, "");
		const afterBridge = content.slice(
			content.indexOf("}", content.indexOf("@theme")),
		);
		expect(afterBridge.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).toEqual([]);
	});

	it("reads the heading and body fonts from theme tokens", () => {
		const content = css();
		expect(content).toMatch(
			/h1,\s*h2,\s*\.rv-heading\s*\{[^}]*font-family:\s*var\(--rv-font-heading,\s*inherit\)/,
		);
		expect(content).toMatch(
			/body\s*\{[^}]*font-family:\s*var\(\s*--rv-font-sans,/,
		);
	});
});

// NOTE: vitest.config.ts and shared/types.ts string-matching tests were
// removed. The Vite build smoke test (tests/integration/build.test.ts)
// validates that the full build pipeline works, which subsumes checking
// that vitest config and RPC types are structurally correct.
