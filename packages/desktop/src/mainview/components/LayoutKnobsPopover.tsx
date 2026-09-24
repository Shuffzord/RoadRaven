import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useId } from "react";
import {
	KNOB_DENSITY_LABEL,
	KNOB_DEPTH_GAP_LABEL,
	KNOB_RESET_LABEL,
	KNOB_SIBLING_GAP_LABEL,
	LAYOUT_KNOBS_TRIGGER_LABEL,
} from "../lib/domContract";
import { KNOB_RANGES } from "../lib/layoutKnobs";
import { useFileViewStore } from "../store/fileViewStore";
import { MENU_SURFACE_CLASS } from "./menuStyles";

const ROW_LABEL_CLASS = "text-[11px] text-rv-text-tertiary";
const RANGE_CLASS = "w-full accent-[var(--rv-accent)]";

/**
 * Small popover, opened from a button next to the TB/LR toggle in the top
 * bar (v0.8.4 Phase 2): three per-file layout comfort knobs, applied live to
 * the canvas via fileViewStore. A Radix DropdownMenu (not Dialog) so it
 * anchors to the trigger the same way FileMenu.tsx does; its native range/
 * radio controls are not registered Menu items, so Radix's roving-focus
 * arrow-key handling (which only fires when the keydown target is the
 * Content element itself) never intercepts them, and useKeyboardRouter's
 * existing `isMenuOpen()` guard (role="menu") already stands down while it
 * is open.
 */
export function LayoutKnobsPopover() {
	const layoutKnobs = useFileViewStore((s) => s.layoutKnobs);
	const setKnob = useFileViewStore((s) => s.setKnob);
	const resetKnobs = useFileViewStore((s) => s.resetKnobs);
	const densityGroupId = useId();

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button
					className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
					type="button"
					aria-label={LAYOUT_KNOBS_TRIGGER_LABEL}
					title={LAYOUT_KNOBS_TRIGGER_LABEL}
				>
					<svg
						aria-hidden="true"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="4" y1="6" x2="20" y2="6" />
						<circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
						<line x1="4" y1="12" x2="20" y2="12" />
						<circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
						<line x1="4" y1="18" x2="20" y2="18" />
						<circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
					</svg>
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className={MENU_SURFACE_CLASS}
					aria-label={LAYOUT_KNOBS_TRIGGER_LABEL}
					align="end"
					sideOffset={4}
					collisionPadding={8}
				>
					<div className="flex flex-col gap-2.5 px-3 py-2.5 w-[220px]">
						<label className="flex flex-col gap-1">
							<span className={ROW_LABEL_CLASS}>{KNOB_SIBLING_GAP_LABEL}</span>
							<input
								className={RANGE_CLASS}
								type="range"
								aria-label={KNOB_SIBLING_GAP_LABEL}
								min={KNOB_RANGES.siblingGap.min}
								max={KNOB_RANGES.siblingGap.max}
								step={KNOB_RANGES.siblingGap.step}
								value={layoutKnobs.siblingGap}
								onChange={(e) => setKnob("siblingGap", Number(e.target.value))}
							/>
						</label>

						<label className="flex flex-col gap-1">
							<span className={ROW_LABEL_CLASS}>{KNOB_DEPTH_GAP_LABEL}</span>
							<input
								className={RANGE_CLASS}
								type="range"
								aria-label={KNOB_DEPTH_GAP_LABEL}
								min={KNOB_RANGES.depthGap.min}
								max={KNOB_RANGES.depthGap.max}
								step={KNOB_RANGES.depthGap.step}
								value={layoutKnobs.depthGap}
								onChange={(e) => setKnob("depthGap", Number(e.target.value))}
							/>
						</label>

						<div
							className="flex flex-col gap-1"
							role="radiogroup"
							aria-label={KNOB_DENSITY_LABEL}
						>
							<span className={ROW_LABEL_CLASS}>{KNOB_DENSITY_LABEL}</span>
							<div className="flex items-center gap-3">
								<label className="flex items-center gap-1.5 text-[12px] text-rv-text-primary">
									<input
										type="radio"
										name={densityGroupId}
										checked={layoutKnobs.density === "comfortable"}
										onChange={() => setKnob("density", "comfortable")}
									/>
									Comfortable
								</label>
								<label className="flex items-center gap-1.5 text-[12px] text-rv-text-primary">
									<input
										type="radio"
										name={densityGroupId}
										checked={layoutKnobs.density === "compact"}
										onChange={() => setKnob("density", "compact")}
									/>
									Compact
								</label>
							</div>
						</div>

						{/* Plain button, not DropdownMenu.Item: Item's onSelect would
						    close the popover on click, which the sliders above must
						    never do while being dragged. */}
						<button
							type="button"
							className="self-start mt-0.5 px-2 h-[24px] rounded-[5px] text-[11px] font-semibold text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
							onClick={resetKnobs}
						>
							{KNOB_RESET_LABEL}
						</button>
					</div>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
