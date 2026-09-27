import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { FORMAT_IDS, type FormatId } from "./promo";

const COPY_FILE = "fixtures/promo-copy.json";

const PromoCopySchema = z.strictObject({
	headline: z.string().min(1),
	subline: z.string().min(1),
	highlights: z.array(z.string().min(1)).min(1).max(3).optional(),
	/** Render `v<version>` above the headline. */
	showVersion: z.boolean().optional(),
});

export type PromoCopy = z.infer<typeof PromoCopySchema>;

const CopyChoiceSchema = z.strictObject({
	picked: z.union([z.literal(0), z.literal(1)]),
	options: z.tuple([PromoCopySchema, PromoCopySchema]),
});

type CopyChoice = z.infer<typeof CopyChoiceSchema>;

/** One entry per promo format, plus the owner's free-text `_comment`. */
const CopyFileSchema = z.strictObject({
	_comment: z.string().optional(),
	...Object.fromEntries(FORMAT_IDS.map((id) => [id, CopyChoiceSchema])),
});

/**
 * Validate promo copy (the parsed `promo-copy.json`). Throws naming the file
 * and the path of each bad field.
 */
export function loadPromoCopy(json: unknown): Record<FormatId, CopyChoice> {
	const result = CopyFileSchema.safeParse(json);
	if (!result.success) {
		const issues = result.error.issues.map(
			(issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`,
		);
		throw new Error(`Invalid ${COPY_FILE}:\n${issues.join("\n")}`);
	}
	const { _comment, ...copy } = result.data;
	return copy as Record<FormatId, CopyChoice>;
}

/** The words on each promo format: two drafted options, the owner picks one. */
export const PROMO_COPY = loadPromoCopy(
	JSON.parse(readFileSync(resolve(__dirname, COPY_FILE), "utf8")),
);
