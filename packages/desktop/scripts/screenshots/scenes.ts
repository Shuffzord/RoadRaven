import type { FixtureId } from "./fixtures/index";

/**
 * One capture scene, as data. `subtreeRoot`, `selectedNode` and `focal` are a
 * literal node id or an anchor name from `BuiltFixture.anchors` (anchor wins).
 */
export interface ScenePreset {
	id: string;
	title: string;
	fixture: FixtureId;
	subtreeRoot?: string;
	layout: "TB" | "LR";
	/** Collapse the nodes at this depth; omitted = expand all. */
	collapseDepth?: number;
	/** Selecting a node opens the detail panel; omitted = panel closed. */
	selectedNode?: string;
	viewport: { width: number; height: number };
	/** Stored for Phase 4 promo cropping; unused by the capture. */
	focal?: string;
	expectedCards: number;
	/** `"none"` = zero plugin badges; a list = each plugin id has >= 1 badge. */
	attribution: "none" | readonly string[];
}

const VIEWPORT = { width: 1600, height: 1200 } as const;

export const SCENES: readonly ScenePreset[] = [
	{
		id: "cfa-overview",
		title: "CFA Level I",
		fixture: "cfa",
		layout: "LR",
		collapseDepth: 1,
		viewport: VIEWPORT,
		expectedCards: 11,
		attribution: "none",
	},
	{
		id: "cfa-detail",
		title: "CFA Level I — Quantitative Methods",
		fixture: "cfa",
		subtreeRoot: "activeModule",
		layout: "LR",
		collapseDepth: 1,
		selectedNode: "activeModule",
		viewport: VIEWPORT,
		expectedCards: 11,
		attribution: "none",
	},
	{
		id: "project-overview",
		title: "Ship v1.0",
		fixture: "project",
		layout: "LR",
		viewport: VIEWPORT,
		expectedCards: 15,
		attribution: "none",
	},
	{
		id: "project-vertical",
		title: "Ship v1.0 — top-down",
		fixture: "project",
		layout: "TB",
		viewport: VIEWPORT,
		expectedCards: 15,
		attribution: "none",
	},
	{
		id: "agent-workflow",
		title: "Ship v1.0 — agents at work",
		fixture: "project-agents",
		layout: "LR",
		viewport: VIEWPORT,
		expectedCards: 15,
		attribution: ["claude-code", "github-actions"],
	},
];

export const SCENE_IDS: readonly string[] = SCENES.map((scene) => scene.id);

export function getScene(id: string): ScenePreset {
	const scene = SCENES.find((candidate) => candidate.id === id);
	if (!scene) throw new Error(`Unknown scene '${id}'`);
	return scene;
}
