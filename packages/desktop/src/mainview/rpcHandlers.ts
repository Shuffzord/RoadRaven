/**
 * RPC message handlers for incoming messages from the Bun process.
 * Separated from rpc.ts to avoid circular imports between rpc and roadmapStore.
 * Uses dynamic import() for ESM safety -- no require().
 *
 * Plan 03-04c (D-14): pushFileChanged now delegates to useFileActions'
 * `handleExternalFileChange` so the dirty-vs-clean decision lives in one
 * place — covered by tests/unit/store/fileActions.test.ts. The clean-state
 * branch preserves Phase 2's auto-reload behavior; the dirty branch routes
 * through setExternalEdit → ExternalEditToast.
 */
export async function handlePushFileChanged(msg: {
	path: string;
}): Promise<void> {
	const { handleExternalFileChange } = await import("./hooks/useFileActions");
	await handleExternalFileChange(msg);
}
