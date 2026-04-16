import ravenLogo from "../assets/raven-logo.svg";

/** Extract filename from a path (browser-safe, no node:path) */
function basename(filePath: string): string {
	return filePath.split(/[\\/]/).pop() ?? filePath;
}

interface WelcomeScreenProps {
	recentFiles: string[];
	onOpenFile: () => void;
	onOpenRecent: (path: string) => void;
	onOpenSample: (name: string) => void;
}

export function WelcomeScreen({
	recentFiles,
	onOpenFile,
	onOpenRecent,
	onOpenSample,
}: WelcomeScreenProps) {
	return (
		<div className="absolute inset-0 flex items-center justify-center z-10">
			<div className="bg-rv-bg-surface border border-rv-border rounded-[12px] p-8 max-w-[480px] w-full shadow-[var(--rv-shadow-config)]">
				{/* Logo */}
				<div className="flex justify-center mb-3">
					<div
						aria-hidden="true"
						className="w-[48px] h-[48px] bg-rv-accent"
						style={{
							maskImage: `url(${ravenLogo})`,
							maskSize: "contain",
							maskRepeat: "no-repeat",
							maskPosition: "center",
							WebkitMaskImage: `url(${ravenLogo})`,
							WebkitMaskSize: "contain",
							WebkitMaskRepeat: "no-repeat",
							WebkitMaskPosition: "center",
						}}
					/>
				</div>

				{/* App name */}
				<h1 className="text-[14px] font-semibold text-rv-text-primary text-center mb-1">
					RoadRaven
				</h1>

				{/* Subheading */}
				<p className="text-[13px] text-rv-text-secondary text-center mb-6">
					Open a roadmap file to get started
				</p>

				{/* Action buttons */}
				<div className="flex items-center justify-center gap-2 mb-6">
					<button
						className="h-8 px-4 bg-rv-accent text-[var(--rv-text-on-accent)] text-[12px] font-semibold rounded-[8px] hover:opacity-90 transition-opacity duration-150"
						type="button"
						onClick={onOpenFile}
					>
						Open File
					</button>
					<button
						className="h-8 px-4 bg-transparent border border-rv-border text-rv-text-tertiary text-[12px] font-semibold rounded-[8px] cursor-not-allowed opacity-60"
						type="button"
						disabled
						title="Coming soon"
					>
						New Roadmap
					</button>
				</div>

				{/* Recent Files */}
				<div className="mb-4">
					<div className="text-[11px] font-semibold uppercase tracking-wider text-rv-text-tertiary mb-2">
						Recent Files
					</div>
					{recentFiles.length === 0 ? (
						<p className="text-[12px] text-rv-text-tertiary">No recent files</p>
					) : (
						<div className="flex flex-col">
							{recentFiles.map((filePath) => (
								<button
									key={filePath}
									className="text-left text-[12px] text-rv-text-secondary hover:text-rv-text-primary hover:bg-rv-bg-hover rounded-[4px] px-2 py-1 transition-colors duration-150"
									type="button"
									onClick={() => onOpenRecent(filePath)}
								>
									{basename(filePath)}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Sample schemas */}
				<div>
					<div className="text-[11px] font-semibold uppercase tracking-wider text-rv-text-tertiary mb-2">
						Try a sample
					</div>
					<div className="text-[12px]">
						<button
							className="text-rv-accent hover:underline bg-transparent border-none cursor-pointer p-0"
							type="button"
							onClick={() => onOpenSample("hello-world")}
						>
							Hello World
						</button>
						<span className="text-rv-text-tertiary mx-1.5">{"\u00B7"}</span>
						<button
							className="text-rv-accent hover:underline bg-transparent border-none cursor-pointer p-0"
							type="button"
							onClick={() => onOpenSample("getting-started")}
						>
							Getting Started
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
