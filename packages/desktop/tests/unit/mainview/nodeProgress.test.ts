import { describe, expect, it } from "vitest";
import { countDone, formatAge } from "../../../src/mainview/lib/nodeProgress";

// v0.8.4 Phase 1 — the in-progress card's progress line math.

describe("countDone", () => {
	it("counts only direct children whose status is completed", () => {
		expect(
			countDone([
				{ status: "completed" },
				{ status: "in-progress" },
				{ status: "completed" },
				{ status: "blocked" },
				{ status: "not-started" },
			]),
		).toBe(2);
	});

	it("is 0 for an empty list", () => {
		expect(countDone([])).toBe(0);
	});
});

describe("formatAge", () => {
	it("renders 0s as seconds", () => {
		expect(formatAge(0)).toBe("0s ago");
	});

	it("renders 59s as seconds", () => {
		expect(formatAge(59_000)).toBe("59s ago");
	});

	it("switches to minutes at 60s", () => {
		expect(formatAge(60_000)).toBe("1m ago");
	});

	it("floors 29m59s to 29m", () => {
		expect(formatAge((29 * 60 + 59) * 1000)).toBe("29m ago");
	});
});
