import { useEffect } from "react";
import { electroview } from "../rpc";
import { useUiStore } from "../store/uiStore";

/**
 * v0.8.2 — restore the persisted sidebar width on launch.
 *
 * Runs once on mount. A missing or non-numeric value leaves the default;
 * an out-of-range one is clamped by `setSidebarWidth`.
 */
export function useSidebarWidthSetting(): void {
	useEffect(() => {
		electroview?.rpc?.request
			.loadSettings({})
			.then(({ settings }) => {
				if (typeof settings.sidebarWidth === "number") {
					useUiStore.getState().setSidebarWidth(settings.sidebarWidth);
				}
			})
			.catch(() => {
				// Settings unavailable — keep the default width.
			});
	}, []);
}
