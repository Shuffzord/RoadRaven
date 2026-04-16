import { bench, describe } from "vitest";
import { useRoadmapStore } from "../../src/mainview/store/roadmapStore";
import { collectNodeIds, generateLargeSchema } from "./generateSchema";

const STATUSES = [
	"not-started",
	"in-progress",
	"completed",
	"blocked",
] as const;

describe("Performance gate: dataKey pattern", () => {
	const schema = generateLargeSchema(300);
	const nodeIds = collectNodeIds(schema);

	bench("loadSchema with 300+ nodes", () => {
		useRoadmapStore.getState().loadSchema(schema, "/tmp/bench.json");
	});

	bench("updateNodeStatus x10 without dataKey increment", () => {
		// Pre-load schema
		const store = useRoadmapStore.getState();
		if (!store.schema) {
			store.loadSchema(schema, "/tmp/bench.json");
		}
		const dataKeyBefore = useRoadmapStore.getState().dataKey;

		// Simulate 10 rapid status updates (1 second of 10/sec)
		for (let i = 0; i < 10; i++) {
			const randomId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
			const randomStatus =
				STATUSES[Math.floor(Math.random() * STATUSES.length)];
			useRoadmapStore.getState().updateNodeStatus(randomId, randomStatus);
		}

		const dataKeyAfter = useRoadmapStore.getState().dataKey;
		// This assertion in a bench is unusual but validates the contract
		if (dataKeyBefore !== dataKeyAfter) {
			throw new Error(
				`dataKey changed from ${dataKeyBefore} to ${dataKeyAfter} on status-only updates — 30fps gate WILL fail`,
			);
		}
	});

	bench(
		"sustained load: 50 updateNodeStatus calls (simulating 5sec at 10/sec)",
		() => {
			const store = useRoadmapStore.getState();
			if (!store.schema) {
				store.loadSchema(schema, "/tmp/bench.json");
			}

			for (let i = 0; i < 50; i++) {
				const randomId = nodeIds[i % nodeIds.length];
				const randomStatus = STATUSES[i % STATUSES.length];
				store.updateNodeStatus(randomId, randomStatus);
			}
		},
	);
});
