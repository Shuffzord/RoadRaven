/**
 * Format a past timestamp as a human-readable relative string.
 * Per UI-SPEC §"SidePanel Integration zone" copy contract:
 *   < 60s  → "just now"
 *   < 60m  → "Xm ago"
 *   < 24h  → "Xh ago"
 *   ≥ 24h  → "Xd ago"
 */
export function formatRelative(lastEventAt: number): string {
	const diff = Date.now() - lastEventAt;
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}
