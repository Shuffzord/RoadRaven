import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
	screenPos: { x: number; y: number };
	value: string;
	onChange: (v: string) => void;
	onCommit: () => void;
	onCancel: () => void;
}

/**
 * Floating rename input rendered into document.body via portal.
 *
 * Positioned centered over the node card (width 220px, offset x-110).
 * Stops mouse events from bubbling to the react-d3-tree canvas so panning
 * and clicks don't fire while editing.
 */
export function InlineRenameInput({
	screenPos,
	value,
	onChange,
	onCommit,
	onCancel,
}: Props) {
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);
	return createPortal(
		<input
			ref={ref}
			type="text"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === "Enter") {
					e.preventDefault();
					onCommit();
				} else if (e.key === "Escape") {
					e.preventDefault();
					onCancel();
				}
			}}
			onBlur={onCommit}
			onMouseDown={(e) => e.stopPropagation()}
			style={{
				position: "fixed",
				left: screenPos.x - 110, // center over 220px card
				top: screenPos.y - 10,
				width: 220,
				minHeight: 20,
				padding: "4px",
				background: "var(--rv-bg-input)",
				border: "1px solid var(--rv-border-focus)",
				borderRadius: 4,
				boxShadow: "0 0 0 3px var(--rv-accent-muted)",
				color: "var(--rv-text-primary)",
				font: "600 13px/1.3 inherit",
				zIndex: 1000,
				outline: "none",
			}}
			aria-label="Rename node"
		/>,
		document.body,
	);
}
