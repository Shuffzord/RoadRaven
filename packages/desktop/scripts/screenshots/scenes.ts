import type { LayoutKnobs } from "../../src/mainview/lib/layoutKnobs";
import type { FixtureId } from "./fixtures/index";

/**
 * One capture scene, as data. `subtreeRoot`, `selectedNode`, `focal` and each
 * `collapsed` entry are a literal node id or an anchor name from
 * `BuiltFixture.anchors` (anchor wins).
 */
export interface ScenePreset {
	id: string;
	title: string;
	fixture: FixtureId;
	subtreeRoot?: string;
	layout: "TB" | "LR";
	/** Collapse the nodes at this depth; omitted (with `collapsed`) = expand all. */
	collapseDepth?: number;
	/** Collapse exactly these nodes; never set together with `collapseDepth`. */
	collapsed?: readonly string[];
	/** Per-file layout knobs set on load; omitted keys keep `KNOB_DEFAULTS`. */
	knobs?: Partial<LayoutKnobs>;
	/** Selecting a node opens the detail panel; omitted = panel closed. */
	selectedNode?: string;
	viewport: { width: number; height: number };
	/** The card promo crops keep in frame (`object-position`); unused by the capture. */
	focal?: string;
	/** `"none"` = zero plugin badges; a list = each plugin id has >= 1 badge. */
	attribution: "none" | readonly string[];
}

const VIEWPORT = { width: 1600, height: 1200 } as const;
const AGENTS = ["claude-code", "github-actions"] as const;

export const SCENES: readonly ScenePreset[] = [
	{
		id: "rr-timeline",
		title: "RoadRaven 0.8 — timeline",
		fixture: "roadraven",
		layout: "TB",
		collapsed: ["v0-8-0", "v0-8-1", "v0-8-2", "v0-8-3", "v0-8-4", "v0-8-5"],
		knobs: { siblingGap: 1.0, depthGap: 2.0 },
		focal: "current",
		viewport: { width: 1920, height: 900 },
		attribution: AGENTS,
	},
	{
		id: "rr-detail",
		title: "RoadRaven 0.8.6 — in flight",
		fixture: "roadraven",
		subtreeRoot: "current",
		layout: "LR",
		selectedNode: "currentPhase",
		focal: "currentPhase",
		viewport: VIEWPORT,
		attribution: AGENTS,
	},
	{
		id: "cfa-overview",
		title: "CFA Level I",
		fixture: "cfa",
		layout: "LR",
		collapseDepth: 1,
		focal: "10000000-0000-4000-8000-000000000000",
		viewport: VIEWPORT,
		attribution: "none",
	},
];

export const SCENE_IDS: readonly string[] = SCENES.map((scene) => scene.id);

export function getScene(id: string): ScenePreset {
	const scene = SCENES.find((candidate) => candidate.id === id);
	if (!scene) throw new Error(`Unknown scene '${id}'`);
	return scene;
}
