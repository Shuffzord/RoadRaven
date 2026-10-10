export type HudAgent = {
	id: string;
	label: string;
	type: string;
	model: string;
	effort: string;
	startedAt: number;
	tokens?: number;
	isDone: boolean;
};

export type HudNode = {
	id: string;
	title: string;
	status: string;
	depth: number;
	type?: string;
	notes?: string;
	priority?: string;
	awaitingUat?: number;
};

export type HudSent = { count: number; at: number; isAwake: boolean };

export type HudConnKind =
	| "connecting"
	| "offline"
	| "noFile"
	| "tooLarge"
	| "other";
export type HudError = { kind: HudConnKind; detail: string };

// UAT notes as last fetched, for the UAT signature they were fetched at (null: fetch again).
export type HudUatNotes = {
	sig: string | null;
	notes: Record<string, string>;
	isFailing: boolean;
};

export type HudSnapshot = { title: string; nodes: HudNode[] };

export type HudPalette = {
	name: string;
	bg: string;
	accent: string;
	onAccent: string;
	primary: string;
	secondary: string;
	tertiary: string;
	border: string;
	notStarted: string;
	inProgress: string;
	completed: string;
	blocked: string;
};

declare module "claude-code" {
	interface PluginState {
		"roadraven-hud": {
			agents: Record<string, HudAgent>;
			owners: Record<string, string>;
			activity: Record<string, string>;
			snapshot: HudSnapshot;
			error: HudError | null;
			startedAt: number;
			palette: HudPalette;
			decisions: Record<string, "pass" | "fail">;
			note: string;
			failNotes: Record<string, string>;
			showBacklog: boolean;
			seenUat: string[];
			openNotes: Record<string, true>;
			sent: HudSent | null;
			roadmapPath: string;
			isSending: boolean;
			confirmRun: string;
			runNotes: string;
			starting: Record<string, true>;
			autoOpened: boolean;
			offlineSince: number;
			lastTry: number;
			uatNotes: HudUatNotes;
		};
	}
}
