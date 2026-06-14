import {
	INITIAL_STATE,
	useRoadmapStore,
} from "../../src/mainview/store/roadmapStore";

/**
 * Reset the roadmap store to its initial state.
 * Used in afterEach/beforeEach across test files.
 */
export function resetStore(): void {
	useRoadmapStore.setState({
		...INITIAL_STATE,
		nodeIndex: new Map(),
	});
}
