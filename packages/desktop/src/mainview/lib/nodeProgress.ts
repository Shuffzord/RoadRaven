/**
 * Progress-line math for an in-progress node card (v0.8.4 Phase 1).
 * Dependency-free: the card feeds it children and ages read from the store.
 */

/** Number of direct children whose status is `completed`. */
export function countDone(children: readonly { status: string }[]): number {
	return children.filter((c) => c.status === "completed").length;
}

/** `Xs ago` under a minute, then whole minutes (`Xm ago`), floored. */
export function formatAge(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
}
