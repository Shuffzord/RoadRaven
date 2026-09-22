// Browser-safe path splitting (no node:path in the renderer). Both separators
// are accepted because the Bun side hands over native paths on every OS.

/** Last path segment, e.g. "C:\\work\\plan.json" → "plan.json". */
export function basename(filePath: string): string {
	return filePath.split(/[\\/]/).pop() ?? filePath;
}

/** Everything before the last separator, or undefined for a bare name. */
export function dirname(filePath: string): string | undefined {
	const cut = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	return cut > 0 ? filePath.slice(0, cut) : undefined;
}
