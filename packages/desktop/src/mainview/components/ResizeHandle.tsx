import { useCallback, useEffect, useRef } from "react";

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

interface ResizeHandleProps {
	onResize: (width: number) => void;
	minWidth: number;
	maxWidth: number;
	currentWidth: number;
	/**
	 * Which edge of the parent the handle sits on. "left" (default) is a
	 * right-anchored panel whose width is measured from the window's right
	 * edge; "right" is a left-anchored panel measured from its own left edge.
	 */
	side?: "left" | "right";
	/** Fired after a drag ends or a keyboard step — the moment to persist. */
	onResizeEnd?: () => void;
	/** Double-click on the handle; typically restores the default width. */
	onReset?: () => void;
	"aria-label"?: string;
}

export function ResizeHandle({
	onResize,
	minWidth,
	maxWidth,
	currentWidth,
	side = "left",
	onResizeEnd,
	onReset,
	"aria-label": ariaLabel = "Resize panel",
}: ResizeHandleProps) {
	const isDragging = useRef(false);
	const parentLeft = useRef(0);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging.current) return;
			const newWidth =
				side === "right"
					? e.clientX - parentLeft.current
					: window.innerWidth - e.clientX;
			const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth));
			onResize(clamped);
		},
		[onResize, minWidth, maxWidth, side],
	);

	const handleMouseUp = useCallback(() => {
		if (!isDragging.current) return;
		isDragging.current = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
		onResizeEnd?.();
	}, [onResizeEnd]);

	useEffect(() => {
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseMove, handleMouseUp]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		isDragging.current = true;
		parentLeft.current =
			e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	// Arrow keys move the handle itself: right grows a left-anchored panel and
	// shrinks a right-anchored one. Home/End jump to the min/max width.
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			let next: number;
			if (e.key === "Home") next = minWidth;
			else if (e.key === "End") next = maxWidth;
			else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
				const towardsRight = e.key === "ArrowRight" ? step : -step;
				const delta = side === "right" ? towardsRight : -towardsRight;
				next = Math.max(minWidth, Math.min(maxWidth, currentWidth + delta));
			} else return;
			e.preventDefault();
			onResize(next);
			onResizeEnd?.();
		},
		[currentWidth, minWidth, maxWidth, onResize, onResizeEnd, side],
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: separator role on div is intentional for resize handle
		<div
			className={`absolute ${side === "right" ? "right-0" : "left-0"} top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-rv-border transition-colors duration-150 z-10`}
			onMouseDown={handleMouseDown}
			onKeyDown={handleKeyDown}
			onDoubleClick={onReset}
			role="separator"
			aria-orientation="vertical"
			aria-valuenow={currentWidth}
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			aria-label={ariaLabel}
			tabIndex={0}
		/>
	);
}
