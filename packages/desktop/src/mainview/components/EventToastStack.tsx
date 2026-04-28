import { useEffect } from "react";
import { useToastStore } from "../store/toastStore";
import { EventToast } from "./EventToast";

/**
 * EventToastStack — renders up to 3 toasts stacked bottom-right.
 * Mounted once in App.tsx beside other fixed-position overlays.
 * Escape key dismisses the top-most (last) toast when any are visible.
 *
 * Position: 48px above status bar (32px) + 16px gutter = bottom: 48.
 * zIndex: 9000 per UI-SPEC (above node canvas, below modal dialogs).
 */
export function EventToastStack() {
	const toasts = useToastStore((s) => s.toasts);
	const dismissToast = useToastStore((s) => s.dismissToast);

	// Escape key dismisses the top-most toast (keyboard accessibility)
	useEffect(() => {
		if (toasts.length === 0) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			const top = toasts[toasts.length - 1];
			if (top) {
				e.preventDefault();
				dismissToast(top.id);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [toasts, dismissToast]);

	if (toasts.length === 0) return null;

	return (
		<div
			style={{
				position: "fixed",
				right: 16,
				bottom: 48,
				display: "flex",
				flexDirection: "column",
				gap: 8,
				zIndex: 9000,
				// Stack doesn't block canvas interaction when no toasts are hovered
				pointerEvents: "none",
			}}
		>
			{toasts.map((t) => (
				<div key={t.id} style={{ pointerEvents: "auto" }}>
					<EventToast toast={t} onDismiss={() => dismissToast(t.id)} />
				</div>
			))}
		</div>
	);
}
