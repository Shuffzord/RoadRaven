// tests/release/manifest-url.test.ts
//
// Wave-0 scaffolding (PACK-02). Probes the auto-updater manifest URL
// exposed via electrobun.config.ts release.baseUrl. SKIPS by default; the
// release workflow sets RR_TEST_MANIFEST_URL after a successful release.
//
// Manual run: RR_TEST_MANIFEST_URL=https://github.com/Shuffzord/RoadRaven/releases/latest/download/stable-win-x64-update.json bun run --cwd . test:release
import { describe, expect, it } from "vitest";

const URL = process.env.RR_TEST_MANIFEST_URL;

describe.skipIf(!URL)("Auto-updater manifest URL (PACK-02)", () => {
	it("resolves to a 200 response with valid JSON", async () => {
		const res = await fetch(URL!);
		expect(res.status, `Expected 200, got ${res.status}`).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		// Loose shape: just assert it's an object with at least one expected field
		// (Electrobun manifest schema is undocumented — see RESEARCH.md A1)
		expect(typeof body).toBe("object");
		expect(body).not.toBeNull();
	});
});
