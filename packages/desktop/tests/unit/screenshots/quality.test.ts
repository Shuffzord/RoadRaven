import { describe, expect, it } from "vitest";
import {
	pngDimensions,
	QUALITY_PROFILES,
} from "../../../scripts/screenshots/quality";

/** A minimal 33-byte PNG: signature + IHDR (length, type, width, height, ...). */
function buildPngHeader(width: number, height: number): Uint8Array {
	const buf = new Uint8Array(33);
	const view = new DataView(buf.buffer);
	buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
	view.setUint32(8, 13); // IHDR chunk length
	buf.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
	view.setUint32(16, width);
	view.setUint32(20, height);
	buf[24] = 8; // bit depth
	buf[25] = 6; // color type
	// bytes 26-28 (compression, filter, interlace) and 29-32 (CRC) are unused by pngDimensions
	return buf;
}

describe("pngDimensions", () => {
	it("decodes a 1600 x 1200 header", () => {
		expect(pngDimensions(buildPngHeader(1600, 1200))).toEqual({
			width: 1600,
			height: 1200,
		});
	});

	it("decodes a 3200 x 2400 header", () => {
		expect(pngDimensions(buildPngHeader(3200, 2400))).toEqual({
			width: 3200,
			height: 2400,
		});
	});

	it("throws on a non-PNG buffer", () => {
		expect(() => pngDimensions(new Uint8Array(33))).toThrow(/not a PNG/);
	});
});

describe("QUALITY_PROFILES", () => {
	it("maps preview/standard/ultra to 1/2/3", () => {
		expect(QUALITY_PROFILES).toEqual({ preview: 1, standard: 2, ultra: 3 });
	});
});
