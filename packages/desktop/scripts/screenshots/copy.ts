import type { FormatId } from "./promo";

export interface PromoCopy {
	headline: string;
	subline: string;
	highlights?: readonly string[];
}

interface CopyChoice {
	picked: 0 | 1;
	options: [PromoCopy, PromoCopy];
}

/** The words on each promo format: two drafted options, the owner picks one. */
export const PROMO_COPY: Record<FormatId, CopyChoice> = {
	// TODO owner pick (D-6)
	"readme-hero": {
		picked: 0,
		options: [
			{
				headline: "Your roadmap as a tree you can see",
				subline:
					"Plain-JSON roadmaps with status on every node, edited from the keyboard.",
			},
			{
				headline: "Plan the work. See where it stands.",
				subline:
					"A desktop roadmap tree with per-node status, markdown notes and progress counts.",
			},
		],
	},
	// TODO owner pick (D-6)
	"social-card": {
		picked: 0,
		options: [
			{
				headline: "A roadmap tree your agents can update",
				subline:
					"RoadRaven keeps plans in plain JSON; Claude Code can report status back to the nodes.",
			},
			{
				headline: "See which tool each task is attributed to",
				subline:
					"Every card shows its status, and a badge for the agent or CI the work is attributed to.",
			},
		],
	},
	// TODO owner pick (D-6)
	"square-feature": {
		picked: 0,
		options: [
			{
				headline: "Every task in one tree",
				subline: "Status on every node, from milestone down to leaf.",
			},
			{
				headline: "What is done, what is next",
				subline:
					"Completed, in progress and not started, readable at a glance.",
			},
		],
	},
	// TODO owner pick (D-6)
	"release-card": {
		picked: 0,
		options: [
			{
				headline: "RoadRaven release",
				subline: "Desktop roadmap trees with live status.",
				highlights: [
					"Status ribbons and progress counts on every card",
					"Eight built-in themes",
					"In-app updates",
				],
			},
			{
				headline: "What's new in RoadRaven",
				subline: "Plain-JSON roadmaps, keyboard-first editing.",
				highlights: [
					"Badges show which agent a task is attributed to",
					"Per-file layout controls",
				],
			},
		],
	},
};
