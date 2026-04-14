export function SidePanel({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  return (
    <aside
      className="[grid-area:panel] bg-rv-bg-panel border-l border-rv-border z-[50] overflow-hidden flex flex-col"
      style={{
        width: isOpen ? 340 : 0,
        transitionProperty: "width",
        transitionDuration: "200ms",
        transitionTimingFunction: "ease-out",
        boxShadow: isOpen ? "var(--rv-shadow-panel)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between min-h-[52px] px-4 py-3.5 border-b border-rv-border shrink-0">
        <span className="text-[14px] font-semibold text-rv-text-primary whitespace-nowrap">
          Node Details
        </span>
        <button
          className="flex items-center justify-center w-7 h-7 rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150"
          type="button"
          onClick={onClose}
          aria-label="Close panel"
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
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* STATUS */}
        <FieldLabel>STATUS</FieldLabel>
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-rv-bg-input border border-rv-border rounded-[6px] mb-4">
          <span className="w-2 h-2 rounded-full bg-rv-status-not-started" />
          <span className="text-[12px] text-rv-text-primary">Not Started</span>
        </div>

        {/* TYPE */}
        <FieldLabel>TYPE</FieldLabel>
        <div className="mb-4">
          <span className="inline-block px-2.5 py-[3px] text-[11px] font-semibold rounded-[4px] bg-rv-accent-muted text-rv-accent">
            Task
          </span>
        </div>

        {/* CREATED / UPDATED */}
        <FieldLabel>CREATED</FieldLabel>
        <MetaRow label="Date" value="2026-04-10" />

        <FieldLabel>UPDATED</FieldLabel>
        <MetaRow label="Date" value="2026-04-13" />

        {/* ID */}
        <FieldLabel>ID</FieldLabel>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[12px] text-rv-text-secondary font-mono">
            node-abc-123
          </span>
          <button
            className="flex items-center justify-center w-5 h-5 rounded-[4px] hover:bg-rv-bg-hover hover:text-rv-accent transition-colors duration-150 text-rv-text-tertiary"
            type="button"
            aria-label="Copy ID"
          >
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-rv-border my-4" />

        {/* NOTES */}
        <FieldLabel>NOTES</FieldLabel>
        <div className="text-[13px] leading-[1.7] text-rv-text-secondary whitespace-pre-wrap">
          Initial setup for the project foundation. Configure the build
          pipeline and establish the{" "}
          <code className="bg-rv-bg-elevated text-rv-accent text-[11px] rounded-[3px] font-mono px-1 py-0.5">
            theme system
          </code>{" "}
          before proceeding with component work.
        </div>
      </div>
    </aside>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-tertiary mb-1.5">
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[12px] text-rv-text-tertiary">{label}</span>
      <span className="text-[12px] text-rv-text-secondary">{value}</span>
    </div>
  );
}
