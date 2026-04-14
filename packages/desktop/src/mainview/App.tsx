import { Canvas } from "./components/Canvas";
import { Sidebar } from "./components/Sidebar";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";

export default function App() {
	return (
		<div id="app" className="h-screen w-screen bg-rv-bg-base">
			<TopBar />
			<Sidebar />
			<Canvas />
			<SidePanel />
			<StatusBar />
		</div>
	);
}
