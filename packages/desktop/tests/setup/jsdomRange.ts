// jsdom has no layout, so Range lacks getClientRects/getBoundingClientRect.
// CodeMirror measures text through them and logs a caught TypeError on every
// measure; empty geometry is what jsdom would report anyway.
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
	Range.prototype.getClientRects = () =>
		({
			length: 0,
			item: () => null,
			[Symbol.iterator]: [][Symbol.iterator],
		}) as unknown as DOMRectList;
	Range.prototype.getBoundingClientRect = () => new DOMRect();
}
