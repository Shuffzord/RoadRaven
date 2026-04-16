import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { RoadmapNode } from "../../../../packages/core/src/schema";
// Use relative path since workspace alias may not resolve in vitest
import {
	NodeStatusSchema,
	RoadmapNodeSchema,
	RoadmapSchemaSchema,
	StatusConfigSchema,
	TypeConfigSchema,
} from "../../../../packages/core/src/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("NodeStatusSchema", () => {
	it("accepts valid status values", () => {
		for (const status of [
			"not-started",
			"in-progress",
			"completed",
			"blocked",
		]) {
			const result = NodeStatusSchema.safeParse(status);
			expect(result.success).toBe(true);
		}
	});

	it("rejects invalid status value", () => {
		const result = NodeStatusSchema.safeParse("invalid-status");
		expect(result.success).toBe(false);
	});
});

describe("StatusConfigSchema", () => {
	it("validates statusConfig with id + label + optional color", () => {
		const result = StatusConfigSchema.safeParse({
			id: "not-started",
			label: "Not Started",
		});
		expect(result.success).toBe(true);

		const withColor = StatusConfigSchema.safeParse({
			id: "blocked",
			label: "Blocked",
			color: "#ef4444",
		});
		expect(withColor.success).toBe(true);
	});
});

describe("TypeConfigSchema", () => {
	it("validates typeConfig with id + label", () => {
		const result = TypeConfigSchema.safeParse({
			id: "milestone",
			label: "Milestone",
		});
		expect(result.success).toBe(true);
	});
});

describe("RoadmapNodeSchema", () => {
	const minimalNode = {
		id: VALID_UUID,
		title: "Test Node",
		status: "not-started",
	};

	it("validates a minimal node", () => {
		const result = RoadmapNodeSchema.safeParse(minimalNode);
		expect(result.success).toBe(true);
	});

	it("validates recursive children correctly (3 levels deep)", () => {
		const deepNode = {
			id: VALID_UUID,
			title: "Root",
			status: "in-progress",
			children: [
				{
					id: "550e8400-e29b-41d4-a716-446655440001",
					title: "Level 1",
					status: "completed",
					children: [
						{
							id: "550e8400-e29b-41d4-a716-446655440002",
							title: "Level 2",
							status: "blocked",
							children: [
								{
									id: "550e8400-e29b-41d4-a716-446655440003",
									title: "Level 3",
									status: "not-started",
								},
							],
						},
					],
				},
			],
		};
		const result = RoadmapNodeSchema.safeParse(deepNode);
		expect(result.success).toBe(true);
	});

	it("accepts optional fields when absent", () => {
		const result = RoadmapNodeSchema.safeParse(minimalNode);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.notes).toBeUndefined();
			expect(result.data.metadata).toBeUndefined();
			expect(result.data.createdAt).toBeUndefined();
			expect(result.data.updatedAt).toBeUndefined();
			expect(result.data.type).toBeUndefined();
			expect(result.data.plugin).toBeUndefined();
			expect(result.data.subscribe).toBeUndefined();
		}
	});

	it("accepts $ref field as optional string", () => {
		const nodeWithRef = {
			...minimalNode,
			$ref: "./other-schema.json",
		};
		const result = RoadmapNodeSchema.safeParse(nodeWithRef);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.$ref).toBe("./other-schema.json");
		}
	});

	it("accepts all optional fields when present", () => {
		const fullNode = {
			...minimalNode,
			type: "milestone",
			notes: "Some notes",
			createdAt: "2026-04-15T10:00:00Z",
			updatedAt: "2026-04-15T11:00:00Z",
			metadata: { priority: "high", assignee: "Claude" },
			plugin: { id: "test-plugin" },
			subscribe: { source: "ws://localhost:8080" },
		};
		const result = RoadmapNodeSchema.safeParse(fullNode);
		expect(result.success).toBe(true);
	});
});

describe("RoadmapSchemaSchema", () => {
	it("validates a well-formed roadmap schema and returns typed data", () => {
		const validSchema = {
			version: "1.0",
			title: "Test Roadmap",
			nodes: [
				{
					id: VALID_UUID,
					title: "Root Node",
					status: "in-progress",
				},
			],
		};
		const result = RoadmapSchemaSchema.safeParse(validSchema);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.version).toBe("1.0");
			expect(result.data.title).toBe("Test Roadmap");
			expect(result.data.nodes).toHaveLength(1);
			expect(result.data.nodes[0].title).toBe("Root Node");
		}
	});

	it("rejects malformed JSON with issues array", () => {
		const result = RoadmapSchemaSchema.safeParse({});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});

	it("validates themeConfig with optional statusColors and nodeRadius", () => {
		const schema = {
			version: "1.0",
			title: "Themed Roadmap",
			themeConfig: {
				statusColors: { "in-progress": "#4a9eff" },
				nodeRadius: 8,
			},
			nodes: [
				{
					id: VALID_UUID,
					title: "Root",
					status: "not-started",
				},
			],
		};
		const result = RoadmapSchemaSchema.safeParse(schema);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.themeConfig?.statusColors?.["in-progress"]).toBe(
				"#4a9eff",
			);
			expect(result.data.themeConfig?.nodeRadius).toBe(8);
		}
	});

	it("validates with statusConfig array", () => {
		const schema = {
			version: "1.0",
			title: "Configured Roadmap",
			statusConfig: [
				{ id: "not-started", label: "Not Started" },
				{ id: "in-progress", label: "In Progress", color: "#4a9eff" },
			],
			nodes: [
				{
					id: VALID_UUID,
					title: "Root",
					status: "completed",
				},
			],
		};
		const result = RoadmapSchemaSchema.safeParse(schema);
		expect(result.success).toBe(true);
	});

	it("validates with typeConfig array", () => {
		const schema = {
			version: "1.0",
			title: "Typed Roadmap",
			typeConfig: [
				{ id: "milestone", label: "Milestone" },
				{ id: "task", label: "Task" },
			],
			nodes: [
				{
					id: VALID_UUID,
					title: "Root",
					status: "not-started",
				},
			],
		};
		const result = RoadmapSchemaSchema.safeParse(schema);
		expect(result.success).toBe(true);
	});
});

// -- Sample schema validation tests ------------------------------------------

const SAMPLES_DIR = resolve(__dirname, "../../../../samples");

function getMaxDepth(nodes: RoadmapNode[], currentDepth = 1): number {
	let max = currentDepth;
	for (const node of nodes) {
		if (node.children && node.children.length > 0) {
			const childDepth = getMaxDepth(node.children, currentDepth + 1);
			if (childDepth > max) max = childDepth;
		}
	}
	return max;
}

function collectStatuses(nodes: RoadmapNode[]): Set<string> {
	const statuses = new Set<string>();
	for (const node of nodes) {
		statuses.add(node.status);
		if (node.children) {
			for (const s of collectStatuses(node.children)) {
				statuses.add(s);
			}
		}
	}
	return statuses;
}

describe("Sample schemas", () => {
	const helloWorldPath = resolve(SAMPLES_DIR, "hello-world.json");
	const gettingStartedPath = resolve(SAMPLES_DIR, "getting-started.json");

	it("hello-world.json validates against RoadmapSchemaSchema", () => {
		const raw = JSON.parse(readFileSync(helloWorldPath, "utf-8"));
		const result = RoadmapSchemaSchema.safeParse(raw);
		expect(result.success).toBe(true);
	});

	it("getting-started.json validates against RoadmapSchemaSchema", () => {
		const raw = JSON.parse(readFileSync(gettingStartedPath, "utf-8"));
		const result = RoadmapSchemaSchema.safeParse(raw);
		expect(result.success).toBe(true);
	});

	it("getting-started.json has nodes at depth >= 3", () => {
		const raw = JSON.parse(readFileSync(gettingStartedPath, "utf-8"));
		const result = RoadmapSchemaSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			const depth = getMaxDepth(result.data.nodes);
			expect(depth).toBeGreaterThanOrEqual(3);
		}
	});

	it("hello-world.json contains at least one node of each status", () => {
		const raw = JSON.parse(readFileSync(helloWorldPath, "utf-8"));
		const result = RoadmapSchemaSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			const statuses = collectStatuses(result.data.nodes);
			expect(statuses.has("not-started")).toBe(true);
			expect(statuses.has("in-progress")).toBe(true);
			expect(statuses.has("completed")).toBe(true);
			expect(statuses.has("blocked")).toBe(true);
		}
	});

	it("getting-started.json contains at least one node of each status", () => {
		const raw = JSON.parse(readFileSync(gettingStartedPath, "utf-8"));
		const result = RoadmapSchemaSchema.safeParse(raw);
		expect(result.success).toBe(true);
		if (result.success) {
			const statuses = collectStatuses(result.data.nodes);
			expect(statuses.has("not-started")).toBe(true);
			expect(statuses.has("in-progress")).toBe(true);
			expect(statuses.has("completed")).toBe(true);
			expect(statuses.has("blocked")).toBe(true);
		}
	});
});

describe("Schema validation — negative cases", () => {
	it("rejects node with empty title", () => {
		const node = { id: crypto.randomUUID(), title: "", status: "not-started" };
		const result = RoadmapNodeSchema.safeParse(node);
		expect(result.success).toBe(false);
	});

	it("rejects node with invalid status", () => {
		const node = {
			id: crypto.randomUUID(),
			title: "Test",
			status: "invalid-status",
		};
		const result = RoadmapNodeSchema.safeParse(node);
		expect(result.success).toBe(false);
	});

	it("rejects schema with missing version", () => {
		const schema = { title: "Test", nodes: [] };
		const result = RoadmapSchemaSchema.safeParse(schema);
		expect(result.success).toBe(false);
	});

	it("rejects schema with missing title", () => {
		const schema = { version: "1.0", nodes: [] };
		const result = RoadmapSchemaSchema.safeParse(schema);
		expect(result.success).toBe(false);
	});

	it("rejects schema with missing nodes", () => {
		const schema = { version: "1.0", title: "Test" };
		const result = RoadmapSchemaSchema.safeParse(schema);
		expect(result.success).toBe(false);
	});
});
