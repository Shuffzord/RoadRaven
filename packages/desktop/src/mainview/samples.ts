// Registry of bundled sample roadmaps.
//
// Discovers every top-level `samples/*.json` at build time via Vite's glob
// import (excluding `*.bak.json` backups), so the WelcomeScreen sample picker
// and the `openSample` loader stay in sync automatically — adding a new sample
// file is enough to surface it in the UI, no code change required.
//
// Loaders are lazy: the JSON for a sample is only fetched when it is opened.

const sampleModules = import.meta.glob<{ default: unknown }>([
	"../../../../samples/*.json",
	"!../../../../samples/*.bak.json",
]);

// Tokens that should render fully uppercase in a sample label.
const SAMPLE_ACRONYMS = new Set([
	"gsd",
	"cfa",
	"mcp",
	"rpc",
	"api",
	"ui",
	"ai",
]);

// Intro samples shown first; everything else follows alphabetically.
const SAMPLE_ORDER = ["hello-world", "getting-started"];

export interface SampleEntry {
	/** File stem (e.g. "hello-world"); passed to `openSample`. */
	name: string;
	/** Human-readable label for the picker (e.g. "Hello World"). */
	label: string;
}

function nameFromPath(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.json$/, "");
}

function sampleLabel(name: string): string {
	return name
		.split(/[-_]/)
		.map((word) =>
			SAMPLE_ACRONYMS.has(word)
				? word.toUpperCase()
				: word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(" ");
}

export const SAMPLES: SampleEntry[] = Object.keys(sampleModules)
	.map(nameFromPath)
	.sort((a, b) => {
		const ai = SAMPLE_ORDER.indexOf(a);
		const bi = SAMPLE_ORDER.indexOf(b);
		if (ai !== -1 || bi !== -1) {
			return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
		}
		return a.localeCompare(b);
	})
	.map((name) => ({ name, label: sampleLabel(name) }));

/** Load a sample's raw JSON by name, or `null` if no such sample is bundled. */
export async function loadSampleData(name: string): Promise<unknown | null> {
	const loader = sampleModules[`../../../../samples/${name}.json`];
	if (!loader) return null;
	return (await loader()).default;
}
