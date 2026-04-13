export function StatusBar() {
  return (
    <footer className="[grid-area:status] flex items-center h-[32px] bg-rv-bg-statusbar border-t border-rv-border px-3.5 text-[11px] text-rv-text-tertiary z-[100] select-none">
      {/* Left section */}
      <div className="flex items-center gap-2.5">
        <span className="w-[7px] h-[7px] rounded-full bg-rv-status-completed shrink-0" />
        <span>Connected</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center section */}
      <div className="flex items-center gap-2.5">
        <span>sample-roadmap.json</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2.5">
        <span>42 nodes</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rv-text-tertiary"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
    </footer>
  );
}
