import { expect, test } from "claude-code/testing";

import {
	describeAction,
	flatten,
	isUat,
	kTokens,
	shortModel,
	since,
} from "./roadmap";
import { AMBER, luminance, rgbOf, solid, toPalette } from "./theme";

test("rgbOf and solid flatten rgba over the background", () => {
	expect(rgbOf("#ff8000")).toEqual([255, 128, 0, 1]);
	expect(rgbOf("rgba(255, 168, 61, 0.5)")).toEqual([255, 168, 61, 0.5]);
	expect(rgbOf("teal")).toBeUndefined();
	expect(solid("rgba(255,255,255,0.5)", "#000000")).toBe("#808080");
	expect(solid("#123456", "#000000")).toBe("#123456");
	expect(solid(undefined, "#000000")).toBeUndefined();
	expect(Math.round(luminance("#ffffff") * 1000)).toBe(1000);
});

test("toPalette fills unset tokens the way the app derives them", () => {
	const p = toPalette({
		meta: { name: "Mini", mode: "light" },
		colors: {
			"bg-base": "#ffffff",
			accent: "#000000",
			"text-primary": "#111111",
			"text-secondary": "#222222",
		},
	});
	expect(p.name).toBe("Mini");
	expect(p.bg).toBe("#ffffff");
	expect(p.tertiary).toBe("#222222"); // text-tertiary falls back to text-secondary
	expect(p.onAccent).toBe("#ffffff"); // black accent takes white ink
	expect(p.border).toBe("#b3b3b3"); // accent at 0.3 over the background
	expect(p.completed).toBe(AMBER.completed);
});

test("flatten keeps reading order, depth and priority", () => {
	const nodes = flatten([
		{
			id: "a",
			title: "A",
			status: "in-progress",
			children: [
				{
					id: "b",
					title: "B",
					status: "not-started",
					metadata: { priority: "next" },
				},
			],
		},
		{ id: "c", title: "C", status: "completed", type: "UAT" },
	]);
	expect(nodes.map((n) => [n.id, n.depth])).toEqual([
		["a", 0],
		["b", 1],
		["c", 0],
	]);
	expect(nodes[1]?.priority).toBe("next");
	expect(isUat(nodes[2] ?? nodes[0]!)).toBe(true);
});

test("describeAction and the small formatters", () => {
	expect(describeAction({ tool: "Bash", command: "bun test\nmore" })).toBe(
		"Bash bun test",
	);
	expect(describeAction({ tool: "Read", file_path: "/a/b/register.tsx" })).toBe(
		"Read register.tsx",
	);
	expect(
		describeAction({
			tool: "mcp__roadraven__updateNodeStatus",
			nodeId: "hud-w1",
		}),
	).toBe("updateNodeStatus hud-w1");
	expect(describeAction({ tool: "TodoWrite" })).toBe("TodoWrite");
	expect(shortModel("claude-haiku-5-5")).toBe("haiku 5.5");
	expect(kTokens(12345)).toBe("12.3k");
	expect(since(0, 75_000)).toBe("1m 15s");
});
