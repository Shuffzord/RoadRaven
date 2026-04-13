import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";

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
