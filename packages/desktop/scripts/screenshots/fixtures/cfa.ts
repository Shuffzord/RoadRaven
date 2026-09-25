import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	type NodeStatus,
	type RoadmapNode,
	RoadmapSchemaSchema,
} from "../../../../core/src/schema";
import { resolveRefsWithOwnership } from "../../../src/bun/resolveRefs";
import { CAPTURE_DIR } from "../sceneLoader";
import type { BuiltFixture } from "./index";

const root = resolve(__dirname, "../../../../..");
const source = resolve(root, "samples/cfa-l1-roadmap.json");

function setBranchStatus(node: RoadmapNode, status: NodeStatus): void {
	node.status = status;
	for (const child of node.children ?? []) setBranchStatus(child, status);
}

// A deterministic study progression, applied only to the in-memory copy.
function startTopic(topic: RoadmapNode, completedModules: number): void {
	topic.status = "in-progress";
	const modules = topic.children ?? [];
	for (const module of modules.slice(0, completedModules)) {
		setBranchStatus(module, "completed");
	}
	const active = modules[completedModules];
	if (!active) return;
	active.status = "in-progress";
	for (const [i, child] of (active.children ?? []).entries()) {
		setBranchStatus(child, i < 2 ? "completed" : "not-started");
		if (i === 2) child.status = "in-progress";
	}
}

function assertResolved(node: RoadmapNode): void {
	if (node.$ref !== undefined) {
		throw new Error(`unresolved reference on ${node.title}`);
	}
	for (const child of node.children ?? []) assertResolved(child);
}

/** Ethics done, Quant 3 modules done + 1 active, Economics 1 done + 1 active. */
function stageStudy(exam: RoadmapNode): RoadmapNode {
	const topics = exam.children ?? [];
	if (topics.length !== 10) {
		throw new Error(`Expected 10 CFA topics, found ${topics.length}`);
	}
	setBranchStatus(exam, "not-started");
	exam.status = "in-progress";
	setBranchStatus(topics[0], "completed");
	startTopic(topics[1], 3);
	startTopic(topics[2], 1);
	const activeModule = topics[1].children?.[3];
	if (!activeModule) {
		throw new Error("Expected an active Quantitative Methods module");
	}
	return activeModule;
}

/** The CFA L1 sample with its `$ref`s resolved and a study progression staged. */
export async function buildCfaFixture(): Promise<BuiltFixture> {
	const sources = new Map<string, string>();
	const readSource = async (path: string) => {
		const text = await readFile(path, "utf8");
		sources.set(path, text);
		return text;
	};
	const schema = RoadmapSchemaSchema.parse(
		JSON.parse(await readSource(source)),
	);
	schema.nodes = await resolveRefsWithOwnership(schema.nodes, source, source, {
		readFile: readSource,
	});
	schema.nodes.forEach(assertResolved);
	const activeModule = stageStudy(schema.nodes[0]);
	RoadmapSchemaSchema.parse(schema);
	// The full demo is portable: written next to the captures, never into samples/.
	await mkdir(CAPTURE_DIR, { recursive: true });
	await writeFile(
		resolve(CAPTURE_DIR, "cfa-l1-demo.json"),
		`${JSON.stringify(schema, null, 2)}\n`,
	);
	return { schema, anchors: { activeModule: activeModule.id }, sources };
}
