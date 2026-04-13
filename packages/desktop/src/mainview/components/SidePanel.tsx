// Stub for Task 1 — full implementation in Task 2 with TDD
export function SidePanel({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  return (
    <aside
      className="[grid-area:panel] bg-rv-bg-panel border-l border-rv-border z-[50] overflow-hidden"
      style={{
        width: isOpen ? 340 : 0,
        transitionProperty: "width",
        transitionDuration: "200ms",
        transitionTimingFunction: "ease-out",
      }}
    />
  );
}
