import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { CSSProperties } from "react";
import { ITEM_CLASS, MENU_SURFACE_CLASS } from "./menuStyles";

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
					className={MENU_SURFACE_CLASS}
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
								className={`${ITEM_CLASS} data-[state=checked]:text-[var(--rv-accent)]`}
							>
								{o.label}
							</DropdownMenu.RadioItem>
						))}
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}
