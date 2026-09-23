// Platform seam — see window.ts for the allow-listed-import rationale.
import { Updater } from "electrobun/bun";

/**
 * Get the current release channel (e.g. "dev", "canary", "stable").
 * SCAF-09: Updater.localInfo.channel() throws when version.json is absent
 * (dev checkout). We catch that and default to "dev" channel.
 */
export async function getReleaseChannel(): Promise<string> {
	try {
		return await Updater.localInfo.channel();
	} catch {
		// version.json not found -- treating as dev channel
		return "dev";
	}
}
