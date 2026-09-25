import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	type RoadmapNode,
	type RoadmapSchema,
	RoadmapSchemaSchema,
} from "../../../../core/src/schema";
import type { BuiltFixture } from "./index";

const source = resolve(__dirname, "project-roadmap.json");

/** Which plugin "did" each node in the agent scene; review/design/decision nodes stay unbadged. */
const ATTRIBUTION: Readonly<Record<string, string>> = {
	"auth-endpoints": "claude-code",
	"sync-service": "claude-code",
	"conflict-merge": "claude-code",
	"dashboard-ui": "claude-code",
	"ci-pipeline": "github-actions",
	"release-build": "github-actions",
};

/** The compact software-project roadmap, unmodified. */
export async function loadProjectFixture(): Promise<BuiltFixture> {
	const text = await readFile(source, "utf8");
	const schema = RoadmapSchemaSchema.parse(JSON.parse(text));
	return { schema, anchors: {}, sources: new Map([[source, text]]) };
}

/** A copy of `schema` with the persistent `plugin: { id }` slot set on agent/CI work. */
export function withAttribution(schema: RoadmapSchema): RoadmapSchema {
	const copy = structuredClone(schema);
	const attribute = (node: RoadmapNode): void => {
		const id = ATTRIBUTION[node.id];
		if (id) node.plugin = { id };
		node.children?.forEach(attribute);
	};
	copy.nodes.forEach(attribute);
	return copy;
}
