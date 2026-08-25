export function Skeleton({ className = "", ...props }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} aria-hidden="true" {...props} />;
}

export function TableSkeleton({ rows = 6, cols = 6, className = "" }) {
  const widths = ["w-[18%]", "w-[22%]", "w-[14%]", "w-[16%]", "w-[15%]", "w-[10%]", "w-[5%]"];
  return (
    <div className={`p-4 space-y-1 ${className}`} role="status" aria-label="Loading">
      <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className={widths[c % widths.length]}>
            <Skeleton className="h-3" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-2.5 border-b border-slate-50 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={widths[c % widths.length]}>
              <Skeleton className={`h-9 max-w-full ${r % 2 === 0 ? "opacity-100" : "opacity-60"}`} style={{ width: `${70 + ((r * 13 + c * 29) % 30)}%` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4, className = "" }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ className = "" }) {
  return (
    <div className={`p-6 space-y-4 ${className}`} role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default Skeleton;
