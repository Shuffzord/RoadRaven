import { readFile } from "node:fs/promises";
import { RoadmapSchemaSchema } from "../../../../core/src/schema";
import type { BuiltFixture } from "./index";

/** A roadmap JSON file, validated and unmodified; `anchors` name nodes in it. */
export async function loadJsonFixture(
	source: string,
	anchors: Record<string, string>,
): Promise<BuiltFixture> {
	const text = await readFile(source, "utf8");
	const schema = RoadmapSchemaSchema.parse(JSON.parse(text));
	return { schema, anchors, sources: new Map([[source, text]]) };
}
