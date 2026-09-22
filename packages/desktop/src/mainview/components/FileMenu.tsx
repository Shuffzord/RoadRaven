import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRecentFiles } from "../hooks/useRecentFiles";
import {
	type FileCommand,
	type FileCommandId,
	fileCommands,
	getFileCommand,
} from "../lib/fileCommands";
import { basename } from "../lib/filePath";
import { trackMenuFocus } from "../lib/focusHandoff";
import { useRoadmapStore } from "../store/roadmapStore";
import {
	HINT_CLASS,
	ITEM_CLASS,
	MENU_SURFACE_CLASS,
	SEP_CLASS,
} from "./menuStyles";

/**
 * The File menu (v0.8.2 D2-A). Every file verb lives in `fileCommands`; this
 * component only lays the registry out. Both the top-bar "File" trigger and
 * the DocumentChip wrap their trigger in it, so there is one item list.
 */
export function FileMenu({ children }: { children: ReactNode }) {
	return (
		// The close hands focus back to the canvas itself (lib/focusHandoff.ts),
		// exactly as the context menu does, because Radix's own restore is off.
		<DropdownMenu.Root onOpenChange={trackMenuFocus}>
			<DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					className={MENU_SURFACE_CLASS}
					// Radix names the content after its trigger (aria-labelledby wins
					// over aria-label); the chip's trigger reads "Current file: …",
					// so the menu states its own name instead.
					aria-labelledby={undefined}
					aria-label="File menu"
					align="start"
					sideOffset={4}
					collisionPadding={8}
					onCloseAutoFocus={(event) => event.preventDefault()}
				>
					<FileMenuItems />
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

function FileMenuItems() {
	// Live enablement: one boolean per verb, shallow-compared so the menu
	// re-renders only when a verb's state actually flips.
	const enabled = useRoadmapStore(
		useShallow(
			(s) =>
				Object.fromEntries(
					fileCommands.map((c) => [c.id, c.isEnabled(s)]),
				) as Record<FileCommandId, boolean>,
		),
	);
	const item = (id: FileCommandId) => (
		<CommandItem command={getFileCommand(id)} enabled={enabled[id]} />
	);
	return (
		<>
			{item("new")}
			{item("open")}
			<OpenRecentSub enabled={enabled.openRecent} />
			<DropdownMenu.Separator className={SEP_CLASS} />
			{item("save")}
			{item("saveAs")}
			<DropdownMenu.Separator className={SEP_CLASS} />
			{item("revealInFolder")}
			{item("copyPath")}
			<DropdownMenu.Separator className={SEP_CLASS} />
			{item("closeFile")}
		</>
	);
}

function CommandItem({
	command,
	enabled,
}: {
	command: FileCommand;
	enabled: boolean;
}) {
	return (
		<DropdownMenu.Item
			className={ITEM_CLASS}
			disabled={!enabled}
			onSelect={() => {
				void command.run();
			}}
		>
			<span>{command.label}</span>
			{command.shortcut && (
				<span className={HINT_CLASS}>{command.shortcut}</span>
			)}
		</DropdownMenu.Item>
	);
}

function OpenRecentSub({ enabled }: { enabled: boolean }) {
	const command = getFileCommand("openRecent");
	const recentFiles = useRecentFiles();
	return (
		<DropdownMenu.Sub>
			<DropdownMenu.SubTrigger className={ITEM_CLASS} disabled={!enabled}>
				<span>{command.label}</span>
				<svg
					width={12}
					height={12}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<title>Open submenu</title>
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</DropdownMenu.SubTrigger>
			<DropdownMenu.Portal>
				<DropdownMenu.SubContent
					className={MENU_SURFACE_CLASS}
					aria-label="Open Recent"
					collisionPadding={8}
				>
					{recentFiles.length === 0 ? (
						<DropdownMenu.Item className={ITEM_CLASS} disabled>
							<span>No recent files</span>
						</DropdownMenu.Item>
					) : (
						recentFiles.map((path) => (
							<DropdownMenu.Item
								key={path}
								className={ITEM_CLASS}
								title={path}
								onSelect={() => {
									void command.run(path);
								}}
							>
								<span className="truncate">{basename(path)}</span>
							</DropdownMenu.Item>
						))
					)}
				</DropdownMenu.SubContent>
			</DropdownMenu.Portal>
		</DropdownMenu.Sub>
	);
}
