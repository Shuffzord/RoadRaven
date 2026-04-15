/**
 * RPC message handlers for incoming messages from the Bun process.
 * Separated from rpc.ts to avoid circular imports between rpc and roadmapStore.
 * Uses dynamic import() for ESM safety -- no require().
 */
export async function handlePushFileChanged(msg: {
	path: string;
}): Promise<void> {
	const { useRoadmapStore } = await import("./store/roadmapStore");
	const { electroview } = await import("./rpc");
	const response = await electroview?.rpc?.request.loadFile({
		path: msg.path,
	});
	if (response) {
		if (response.data) {
			useRoadmapStore.getState().reloadSchema(response.data);
		}
		useRoadmapStore.getState().setSchemaErrors(response.errors ?? []);
	}
}
