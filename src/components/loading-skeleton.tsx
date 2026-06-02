/**
 * components/loading-skeleton.tsx
 * --------------------------------
 * Reusable skeleton loading components for the dashboard.
 * These show pulsing placeholder shapes while real data loads,
 * giving users visual feedback that content is on its way.
 *
 * Three variants:
 * - TableSkeleton — mimics a data table with rows
 * - ChartSkeleton — mimics a chart card area
 * - CardSkeleton  — generic card placeholder
 */

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-[200px] bg-neutral-800 rounded-md animate-pulse" />
        <div className="h-9 w-[140px] bg-neutral-800 rounded-md animate-pulse" />
        <div className="h-9 w-[130px] bg-neutral-800 rounded-md animate-pulse" />
        <div className="h-9 w-[140px] bg-neutral-800 rounded-md animate-pulse" />
        <div className="ml-auto h-9 w-[120px] bg-neutral-800 rounded-md animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-neutral-800 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 h-10 bg-neutral-900/50 border-b border-neutral-800">
          {[100, 200, 90, 80, 70, 50, 60, 60, 60, 80, 120].map((w, i) => (
            <div
              key={i}
              className="h-3 bg-neutral-700/50 rounded animate-pulse"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center gap-4 px-4 h-12 border-b border-neutral-800/50 last:border-0"
          >
            {/* Key badge */}
            <div className="h-5 w-[80px] bg-neutral-800 rounded-full animate-pulse" />
            {/* Summary */}
            <div
              className="h-4 bg-neutral-800 rounded animate-pulse"
              style={{ width: `${150 + Math.random() * 150}px` }}
            />
            {/* Status badge */}
            <div className="h-5 w-[70px] bg-neutral-800 rounded-full animate-pulse" />
            {/* Priority */}
            <div className="h-4 w-[60px] bg-neutral-800 rounded animate-pulse" />
            {/* Type */}
            <div className="h-4 w-[50px] bg-neutral-800 rounded animate-pulse" />
            {/* SP */}
            <div className="h-4 w-[30px] bg-neutral-800 rounded animate-pulse" />
            {/* Checkboxes */}
            <div className="h-4 w-4 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-4 bg-neutral-800 rounded animate-pulse" />
            <div className="h-4 w-4 bg-neutral-800 rounded animate-pulse" />
            {/* Lead time */}
            <div className="h-4 w-[40px] bg-neutral-800 rounded animate-pulse" />
            {/* Assignees */}
            <div className="flex -space-x-1">
              <div className="h-6 w-6 bg-neutral-800 rounded-full animate-pulse" />
              <div className="h-6 w-6 bg-neutral-800 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer skeleton */}
      <div className="flex justify-between pt-1">
        <div className="h-3 w-[120px] bg-neutral-800 rounded animate-pulse" />
        <div className="h-3 w-[80px] bg-neutral-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4"
        >
          {/* Title area */}
          <div className="space-y-2">
            <div className="h-5 w-[180px] bg-neutral-800 rounded animate-pulse" />
            <div className="h-3 w-[260px] bg-neutral-800/60 rounded animate-pulse" />
          </div>
          {/* Chart area */}
          <div className="h-[300px] bg-neutral-800/30 rounded-lg animate-pulse flex items-end justify-around px-6 pb-6 gap-3">
            {Array.from({ length: 6 }).map((_, barIdx) => (
              <div
                key={barIdx}
                className="bg-neutral-700/30 rounded-t"
                style={{
                  width: "40px",
                  height: `${80 + Math.random() * 150}px`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-neutral-800 rounded-lg animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-[60%] bg-neutral-800 rounded animate-pulse" />
              <div className="h-3 w-[40%] bg-neutral-800/60 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-3 w-full bg-neutral-800/40 rounded animate-pulse" />
          <div className="h-3 w-[80%] bg-neutral-800/40 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
