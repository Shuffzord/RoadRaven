import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { CSSProperties } from "react";
import { MENU_SELECT_CHECK_TESTID } from "../lib/domContract";
import { ITEM_CLASS, MENU_SURFACE_CLASS } from "./menuStyles";

// A long list (many event sources, a schema with many types) stays inside
// the window and scrolls, as the native select did. Radix measures the room
// left on the opening side, collisionPadding included.
const SCROLL_CLASS =
	"max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto";
// Windows High Contrast (forced-colors) drops background and text colours,
// so the keyboard highlight gets an outline there; the ✓ marks the checked
// option in every mode.
const ITEM_EXTRA_CLASS =
	"data-[state=checked]:text-[var(--rv-accent)] forced-colors:data-[highlighted]:outline-solid forced-colors:data-[highlighted]:outline-2 forced-colors:data-[highlighted]:-outline-offset-2";

export interface MenuSelectOption {
	value: string;
	label: string;
}

/**
 * A dropdown picker drawn in the page (Radix DropdownMenu radio group) in
 * place of a native select element: on Linux the renderer is CEF, where a
 * native select never opens its popup. Keyboard: Enter / Space / ArrowDown opens,
 * arrows move, Enter picks, Escape closes; focus returns to the trigger.
 */
export function MenuSelect({
	label,
	value,
	options,
	onChange,
	className,
	style,
}: {
	label: string;
	value: string;
	options: MenuSelectOption[];
	onChange: (value: string) => void;
	className?: string;
	style?: CSSProperties;
}) {
	const current = options.find((o) => o.value === value)?.label ?? value;
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<button
					type="button"
					aria-label={label}
					className={className}
					style={{ display: "flex", alignItems: "center", gap: 4, ...style }}
				>
					<span className="flex-1 text-left truncate">{current}</span>
					<span aria-hidden="true">▾</span>
				</button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className={`${MENU_SURFACE_CLASS} ${SCROLL_CLASS}`}
					aria-labelledby={undefined}
					aria-label={label}
					align="start"
					sideOffset={4}
					collisionPadding={8}
				>
					<DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
						{options.map((o) => (
							<DropdownMenu.RadioItem
								key={o.value}
								value={o.value}
								className={`${ITEM_CLASS} ${ITEM_EXTRA_CLASS}`}
							>
								{o.label}
								<DropdownMenu.ItemIndicator
									aria-hidden="true"
									data-testid={MENU_SELECT_CHECK_TESTID}
									className="ml-3"
								>
									✓
								</DropdownMenu.ItemIndicator>
							</DropdownMenu.RadioItem>
						))}
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
