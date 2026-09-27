/** Capture quality: a run-level device scale factor, constant CSS geometry. */
export const QUALITY_PROFILES = {
	preview: 1,
	standard: 2,
	ultra: 3,
} as const;

export type QualityId = keyof typeof QUALITY_PROFILES;

export const QUALITY_IDS = Object.keys(
	QUALITY_PROFILES,
) as readonly QualityId[];

export const DEFAULT_QUALITY: QualityId = "preview";

function isQualityId(value: string): value is QualityId {
	return (QUALITY_IDS as readonly string[]).includes(value);
}

/** The requested quality, read once from `ROADRAVEN_CAPTURE_QUALITY`; invalid/missing = default. */
export function qualityFromEnv(): QualityId {
	const value = process.env.ROADRAVEN_CAPTURE_QUALITY;
	return value !== undefined && isQualityId(value) ? value : DEFAULT_QUALITY;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decode a PNG's IHDR width/height (bytes 16-24, big-endian). Throws on a bad signature. */
export function pngDimensions(buf: Uint8Array): {
	width: number;
	height: number;
} {
	for (let i = 0; i < PNG_SIGNATURE.length; i++) {
		if (buf[i] !== PNG_SIGNATURE[i]) {
			throw new Error("pngDimensions: not a PNG (bad signature)");
		}
	}
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}
