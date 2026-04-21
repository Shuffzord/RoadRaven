import { lazy, Suspense, useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { SaveFailureModal } from "./components/SaveFailureModal";
import { Sidebar } from "./components/Sidebar";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";
import { useAutosave } from "./hooks/useAutosave";
import { useRoadmapStore } from "./store/roadmapStore";

// Dev-only harness for previewing panels (auto-discovered). Vite treeshakes this
// import out of production builds via the `import.meta.env.DEV` guard.
const DevHarnessLazy = import.meta.env.DEV
	? lazy(() =>
			import("../renderer/components/_dev/DevHarness").then((m) => ({
				default: m.DevHarness,
			})),
		)
	: null;

export default function App() {
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const setSelectedNode = useRoadmapStore((s) => s.setSelectedNode);
	const isOpen = selectedNodeId !== null;

	useAutosave();

	// Dev-only test hook for deterministic UI tests (Playwright render-budget
	// checks). Stripped from production builds by Vite's dead-code elimination.
	useEffect(() => {
		if (import.meta.env.DEV) {
			(
				window as unknown as { __ROADRAVEN_TEST__?: unknown }
			).__ROADRAVEN_TEST__ = {
				loadSchema: (schema: unknown) => {
					useRoadmapStore.getState().loadSchema(schema as never, "");
				},
			};
		}
	}, []);

	return (
		<div id="app" className="h-screen w-screen bg-rv-bg-base">
			<TopBar />
			<Sidebar />
			<Canvas />
			<SidePanel isOpen={isOpen} onClose={() => setSelectedNode(null)} />
			<StatusBar />
			<ConfirmationDialog />
			<SaveFailureModal />
			{import.meta.env.DEV && DevHarnessLazy && (
				<Suspense fallback={null}>
					<DevHarnessLazy />
				</Suspense>
			)}
		</div>
	);
}
