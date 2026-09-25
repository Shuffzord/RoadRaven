import type { RoadmapSchema } from "../../../../core/src/schema";
import { buildCfaFixture } from "./cfa";
import { loadProjectFixture, withAttribution } from "./project";

export const FIXTURE_IDS = ["cfa", "project", "project-agents"] as const;
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
	const project = await loadProjectFixture();
	if (id === "project") return project;
	return { ...project, schema: withAttribution(project.schema) };
}
