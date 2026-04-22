import { useCallback } from "react";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";

async function loadAndApply(path: string): Promise<void> {
	try {
		const response = await electroview?.rpc?.request.loadFile({ path });
		if (response?.data) {
			useRoadmapStore.getState().loadSchema(response.data, path);
		}
		useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
	} catch {
		useRoadmapStore.getState().setSchemaErrors([
			{
				path: "",
				message: `Failed to load file: ${path}`,
				code: "rpc_error",
			},
		]);
	}
}

export function useFileActions() {
	const openFile = useCallback(async () => {
		if (electroview) {
			const path = await electroview.rpc?.request.openFilePicker({});
			if (!path) return;
			await loadAndApply(path);
		} else {
			// Dev mode fallback
			const { RoadmapSchemaSchema } = await import(
				"../../../../../packages/core/src/schema"
			);
			const sample = (
				await import("../../../../../samples/getting-started.json")
			).default;
			const result = RoadmapSchemaSchema.safeParse(sample);
			if (result.success) {
				// HMR / browser-only fallback: no real disk path, autosave stays paused
				// until the user explicitly saves via File > Save As.
				useRoadmapStore.getState().loadSchema(result.data, null);
			}
		}
	}, []);

	const openRecent = useCallback(async (path: string) => {
		if (electroview) {
			await loadAndApply(path);
		}
	}, []);

	const openSample = useCallback(async (name: string) => {
		try {
			let sampleData: unknown;
			if (name === "hello-world") {
				sampleData = (await import("../../../../../samples/hello-world.json"))
					.default;
			} else {
				sampleData = (
					await import("../../../../../samples/getting-started.json")
				).default;
			}
			const { RoadmapSchemaSchema } = await import(
				"../../../../../packages/core/src/schema"
			);
			const result = RoadmapSchemaSchema.safeParse(sampleData);
			if (result.success) {
				// Sample loaded into memory only — autosave needs File > Save As
				// to obtain a real path before writing to disk.
				useRoadmapStore.getState().loadSchema(result.data, null);
			}
		} catch {
			// Sample load failed silently
		}
	}, []);

	return { openFile, openRecent, openSample };
}
