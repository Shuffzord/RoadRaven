// Fails any test that writes to console.error or console.warn, so a passing
// run prints nothing and a new warning (React act(), a jsdom gap, a caught
// error) shows up as a red test instead of scrolling past. A test that expects
// a log silences it itself: `vi.spyOn(console, "warn").mockImplementation(...)`
// replaces this recorder, so its calls never reach it.
import { beforeEach } from "vitest";

const original = { error: console.error, warn: console.warn };

// The check runs in onTestFinished, after every afterEach hook: throwing from
// an afterEach would skip RTL's cleanup() and leak the DOM into later tests.
beforeEach(({ onTestFinished }) => {
	const calls: string[] = [];
	for (const level of ["error", "warn"] as const) {
		console[level] = (...args: unknown[]) => {
			calls.push(`console.${level}: ${args.map(String).join(" ")}`);
			original[level](...args);
		};
	}
	onTestFinished(() => {
		console.error = original.error;
		console.warn = original.warn;
		if (calls.length > 0) {
			throw new Error(
				`Unexpected console output (spy on console in the test if it is expected):\n${calls.join("\n")}`,
			);
		}
	});
});
