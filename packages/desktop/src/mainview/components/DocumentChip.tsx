import { useShallow } from "zustand/react/shallow";
import { SAVE_STATE_ATTR } from "../lib/domContract";
import { basename } from "../lib/filePath";
import { saveDotClass } from "../lib/saveDot";
import { useRoadmapStore } from "../store/roadmapStore";
import { FileMenu } from "./FileMenu";

/**
 * Top-bar document identity (v0.8.2 D3): save-state dot + basename, the full
 * path and any linked (ownership-split) files in the native tooltip, and the
 * File menu on click. Renders nothing while no document is open.
 */
export function DocumentChip() {
	const { schema, filePath, isUntitled, linkedFiles, saveState } =
		useRoadmapStore(
			useShallow((s) => ({
				schema: s.schema !== null,
				filePath: s.filePath,
				isUntitled: s.isUntitled,
				linkedFiles: s.linkedFiles,
				saveState: s.saveState,
			})),
		);
	if (!schema) return null;

	const untitled = isUntitled || !filePath;
	const name = untitled ? "Untitled" : basename(filePath);
	const lines = [untitled ? "Untitled — not saved yet" : filePath];
	if (linkedFiles.length > 0) {
		lines.push(
			`Linked files (${linkedFiles.length}):`,
			...linkedFiles.map(basename),
		);
	}

	return (
		<FileMenu>
			<button
				type="button"
				className="flex items-center gap-1.5 max-w-[240px] h-[28px] px-2.5 rounded-[6px] text-[12px] text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150"
				title={lines.join("\n")}
				aria-label={`Current file: ${name}`}
			>
				<span
					aria-hidden="true"
					{...{ [SAVE_STATE_ATTR]: untitled ? "untitled" : saveState }}
					className={`shrink-0 ${saveDotClass(untitled ? "untitled" : saveState)}`}
				/>
				<span className="truncate">{name}</span>
			</button>
		</FileMenu>
	);
}
