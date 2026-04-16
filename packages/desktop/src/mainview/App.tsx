import { Canvas } from "./components/Canvas";
import { Sidebar } from "./components/Sidebar";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";
import { useRoadmapStore } from "./store/roadmapStore";

export default function App() {
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const setSelectedNode = useRoadmapStore((s) => s.setSelectedNode);
	const isOpen = selectedNodeId !== null;

	return (
		<div id="app" className="h-screen w-screen bg-rv-bg-base">
			<TopBar />
			<Sidebar />
			<Canvas />
			<SidePanel isOpen={isOpen} onClose={() => setSelectedNode(null)} />
			<StatusBar />
		</div>
	);
}
