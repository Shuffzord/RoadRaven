import { useState } from "react";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className={`[grid-area:sidebar] bg-rv-bg-surface border-r border-rv-border z-[50] flex flex-col overflow-hidden ${
        collapsed ? "w-[48px]" : "w-[220px]"
      }`}
      style={{ transitionProperty: "width", transitionDuration: "200ms" }}
      aria-label="Sidebar navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-[40px] px-3 border-b border-rv-border shrink-0">
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-tertiary">
            Explorer
          </span>
        )}
        <button
          className="flex items-center justify-center w-6 h-6 rounded-[4px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-all duration-150 ml-auto"
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Collapse sidebar"
          title="Ctrl+B"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 py-2 overflow-y-auto">
        {/* Recent Files section */}
        <SectionHeader label="Recent Files" collapsed={collapsed} />
        <FileItem name="project-roadmap.json" collapsed={collapsed} />
        <FileItem name="sprint-backlog.json" collapsed={collapsed} />
        <FileItem name="release-plan.json" collapsed={collapsed} />

        {/* Outline section */}
        <SectionHeader label="Outline" collapsed={collapsed} />
        <FileItem name="Phase 1: Foundation" collapsed={collapsed} />
        <FileItem name="Phase 2: Data Wiring" collapsed={collapsed} />
      </div>

      {/* Bottom section */}
      <div className="border-t border-rv-border p-2 shrink-0">
        <BottomButton icon={<SettingsIcon />} label="Preferences" collapsed={collapsed} />
        <BottomButton icon={<HelpIcon />} label="Help" collapsed={collapsed} />
      </div>
    </nav>
  );
}

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-rv-text-tertiary px-3.5 py-1.5">
      {label}
    </div>
  );
}

function FileItem({ name, collapsed }: { name: string; collapsed: boolean }) {
  return (
    <button
      className={`flex items-center w-full text-rv-text-secondary text-[12px] hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150 ${
        collapsed ? "justify-center py-1.5" : "gap-2 px-3.5 py-[5px]"
      }`}
      type="button"
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-rv-text-tertiary shrink-0"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      {!collapsed && <span className="truncate">{name}</span>}
    </button>
  );
}

function BottomButton({
  icon,
  label,
  collapsed,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <button
      className={`flex items-center w-full rounded-[6px] text-[12px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150 ${
        collapsed ? "justify-center py-1.5" : "gap-2 px-2 py-1.5"
      }`}
      type="button"
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
