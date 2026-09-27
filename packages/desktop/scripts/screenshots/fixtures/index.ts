import { resolve } from "node:path";
import type { RoadmapSchema } from "../../../../core/src/schema";
import { buildCfaFixture } from "./cfa";
import { loadJsonFixture } from "./json";

export const FIXTURE_IDS = ["cfa", "roadraven"] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

export interface BuiltFixture {
	schema: RoadmapSchema;
	/** Named node ids a preset may reference instead of a literal id. */
	anchors: Record<string, string>;
	/** Source file path -> original text, for the byte-identical check. */
	sources: Map<string, string>;
}

export async function buildFixture(id: FixtureId): Promise<BuiltFixture> {
	if (id === "cfa") return buildCfaFixture();
	return loadJsonFixture(resolve(__dirname, "roadraven-08.json"), {
		current: "v0-8-6",
		currentPhase: "curate",
	});
}
