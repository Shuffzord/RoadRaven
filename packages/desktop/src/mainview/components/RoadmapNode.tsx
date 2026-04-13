// Stub for Task 1 — full implementation in Task 2 with TDD
export function RoadmapNode({
  title,
  status,
}: {
  title: string;
  status: "not-started" | "in-progress" | "completed" | "blocked";
}) {
  return (
    <div className="node relative min-w-[180px] max-w-[220px] rounded-lg bg-rv-bg-node p-3 select-none">
      <span className="text-[13px] font-semibold text-rv-text-primary">{title}</span>
      <span className="text-[11px] text-rv-text-secondary ml-2">{status}</span>
    </div>
  );
}
