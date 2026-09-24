import { useEffect } from "react";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";
import { useUiStore } from "../store/uiStore";

/**
 * v0.8.2 — restore persisted UI preferences on launch: the sidebar width and
 * the search-box "include notes" toggle, from one loadSettings round-trip.
 *
 * Runs once on mount. A missing or wrongly-typed value leaves the default;
 * an out-of-range width is clamped by `setSidebarWidth`.
 */
export function useUiSettingsHydration(): void {
	useEffect(() => {
		electroview?.rpc?.request
			.loadSettings({})
			.then(({ settings }) => {
				if (typeof settings.sidebarWidth === "number") {
					useUiStore.getState().setSidebarWidth(settings.sidebarWidth);
				}
				if (typeof settings.searchInNotes === "boolean") {
					useRoadmapStore.getState().setSearchInNotes(settings.searchInNotes);
				}
			})
			.catch(() => {
				// Settings unavailable — keep the defaults.
			});
	}, []);
}
