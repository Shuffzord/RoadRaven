export default function App() {
	return (
		<div id="app" className="h-screen w-screen bg-rv-bg-base">
			<div className="[grid-area:topbar] h-[50px] bg-rv-bg-surface border-b border-rv-border" />
			<div className="[grid-area:sidebar] w-[220px] bg-rv-bg-surface border-r border-rv-border" />
			<div className="[grid-area:canvas] bg-rv-bg-canvas" />
			<div className="[grid-area:panel]" />
			<div className="[grid-area:status] h-[32px] bg-rv-bg-statusbar border-t border-rv-border" />
		</div>
	);
}
