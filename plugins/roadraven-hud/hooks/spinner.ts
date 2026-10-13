// The opt-in raven spinner: the values of the `spinner` option, the verb Claude Code's spinner
// shows per mode, and the suffix that names the node an agent is working on.

export const SPINNER = { CLASSIC: "classic", RAVEN: "raven" } as const;

// One verb per mode, so the word does not flicker between redraws.
export const SPINNER_VERBS = {
	requesting: "Scouting",
	thinking: "Circling",
	responding: "Perching",
	"tool-input": "Gathering",
	"tool-use": "Foraging",
} as const;

export const TITLE_MAX = 32;

export const ravenWord = (mode: string) =>
	SPINNER_VERBS[mode as keyof typeof SPINNER_VERBS] ?? SPINNER_VERBS.thinking;

const shortTitle = (title: string) =>
	title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;

// Ours goes after any suffix already there (the engine's own is its ellipsis).
export const ravenSuffix = (existing: string | undefined, title?: string) =>
	`${existing ?? "…"} · RR${title ? ` ▸ ${shortTitle(title)}` : ""}`;
