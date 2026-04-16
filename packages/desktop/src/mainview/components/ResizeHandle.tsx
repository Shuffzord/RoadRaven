import { useCallback, useEffect, useRef } from "react";

interface ResizeHandleProps {
	onResize: (width: number) => void;
	minWidth: number;
	maxWidth: number;
	currentWidth: number;
}

export function ResizeHandle({
	onResize,
	minWidth,
	maxWidth,
	currentWidth,
}: ResizeHandleProps) {
	const isDragging = useRef(false);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging.current) return;
			const newWidth = window.innerWidth - e.clientX;
			const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth));
			onResize(clamped);
		},
		[onResize, minWidth, maxWidth],
	);

	const handleMouseUp = useCallback(() => {
		isDragging.current = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}, []);

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
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	return (
		// biome-ignore lint/a11y/useSemanticElements: separator role on div is intentional for resize handle
		// biome-ignore lint/a11y/useFocusableInteractive: resize handle is mouse-only interaction
		<div
			className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-rv-border transition-colors duration-150 z-10"
			onMouseDown={handleMouseDown}
			role="separator"
			aria-orientation="vertical"
			aria-valuenow={currentWidth}
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			aria-label="Resize panel"
			tabIndex={0}
		/>
	);
}
