// release-smoke runs the same plugin update commands as the app's dialog and
// toast. The script runs on import, so this only checks where they come from.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("release-smoke takes the update commands from shared/claudePlugin.ts", () => {
	const src = readFileSync("scripts/release-smoke.ts", "utf8");
	expect(src).toMatch(
		/import \{[^}]*\bPLUGIN_UPDATE_STEPS\b[^}]*\} from "\.\.\/shared\/claudePlugin(\.ts)?"/,
	);
	expect(src).not.toContain("EventToast.tsx");
});
