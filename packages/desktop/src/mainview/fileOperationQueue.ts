let tail: Promise<void> = Promise.resolve();

/** Serialize operations that replace a document or change Bun's file binding. */
export function serializeFileOperation<T>(
	operation: () => Promise<T>,
): Promise<T> {
	const result = tail.then(operation, operation);
	tail = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}
