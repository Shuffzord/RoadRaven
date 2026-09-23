/**
 * Runtime validator for theme files (v0.8.3 Phase 3). The shape and the
 * value grammars come from shared/themeSchema.ts; this is the zod binding
 * (zod is not resolvable from shared/ — see that file's header). Phase 4
 * runs every user file through it before a single value reaches CSS.
 */

import { z } from "zod";
import {
	COLOR_VALUE_PATTERN,
	FONT_KEYS,
	FONT_STACK_PATTERN,
	isSafeCssValue,
	PX_VALUE_PATTERN,
	REQUIRED_COLOR_KEYS,
	SHADOW_KEYS,
	SHADOW_VALUE_PATTERN,
	SHAPE_KEYS,
	THEME_COLOR_KEYS,
	THEME_ID_PATTERN,
	type ThemeFile,
} from "../../../../../shared/themeSchema";

const colour = z
	.string()
	.regex(COLOR_VALUE_PATTERN, "expected #rrggbb, rgb() or rgba()");
const px = z.string().regex(PX_VALUE_PATTERN, "expected a px length (or 0)");
const fontStack = z
	.string()
	.regex(
		FONT_STACK_PATTERN,
		"font stack: letters, digits, spaces, quotes, commas and hyphens only",
	);
const shadow = z
	.string()
	.regex(
		SHADOW_VALUE_PATTERN,
		"shadow: lengths, colours, none or var(--rv-*) only",
	)
	.refine(isSafeCssValue, "url() is not allowed");

const knownColour = new Set(THEME_COLOR_KEYS);
const colors = z.record(z.string(), colour).superRefine((value, ctx) => {
	for (const key of REQUIRED_COLOR_KEYS) {
		if (!(key in value)) {
			ctx.addIssue({
				code: "custom",
				path: [key],
				message: `missing required colour "${key}"`,
			});
		}
	}
	for (const key of Object.keys(value)) {
		if (!knownColour.has(key)) {
			ctx.addIssue({
				code: "custom",
				path: [key],
				message: `unknown colour token "${key}"`,
			});
		}
	}
});

/** An object whose only allowed keys are `keys`, each optional. */
function optionalKeys<K extends string>(
	keys: readonly K[],
	value: z.ZodString,
) {
	return z.strictObject(
		Object.fromEntries(keys.map((k) => [k, value.optional()])) as Record<
			K,
			z.ZodOptional<z.ZodString>
		>,
	);
}

export const ThemeFileSchema = z.strictObject({
	id: z
		.string()
		.regex(THEME_ID_PATTERN, "id: lowercase letters, digits and hyphens"),
	meta: z.strictObject({
		name: z.string().min(1),
		mode: z.enum(["dark", "light"]),
		description: z.string().optional(),
		author: z.string().optional(),
	}),
	colors,
	shape: optionalKeys(SHAPE_KEYS, px).optional(),
	fonts: optionalKeys(FONT_KEYS, fontStack).optional(),
	shadows: optionalKeys(SHADOW_KEYS, shadow).optional(),
}) satisfies z.ZodType<ThemeFile>;
