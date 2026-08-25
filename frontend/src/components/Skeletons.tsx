/**
 * Skeleton UI — ачаалж буй төлөвт хэрэглэгчид хоосон дэлгэц биш, бүтцийн
 * хэлбэр харуулна (layout shift-ээс сэргийлнэ).
 */
import type { ReactNode } from "react";

function Bar({ className = "" }: { className?: string }): ReactNode {
  return <div className={`animate-pulse rounded-sm bg-panel2 ${className}`} />;
}

export function ChartSkeleton(): ReactNode {
  return (
    <div className="flex h-full w-full flex-col justify-end gap-2 p-4">
      <div className="flex items-end justify-between gap-1.5">
        {Array.from({ length: 28 }, (_, i) => (
          <div key={i} className="flex-1">
            <div
              className="animate-pulse rounded-sm bg-panel2"
              style={{ height: `${24 + ((i * 37) % 55)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <Bar className="h-3 w-20" />
        <Bar className="h-3 w-14" />
        <Bar className="h-3 w-16" />
      </div>
    </div>
  );
}

export function SignalSkeleton(): ReactNode {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <Bar className="h-9 w-28" />
        <Bar className="h-6 w-16" />
      </div>
      <Bar className="h-24 w-full" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Bar className="h-4 w-20" />
            <Bar className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisSkeleton(): ReactNode {
  return (
    <div className="space-y-5 p-6">
      <Bar className="h-5 w-56" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Bar key={i} className={`h-3.5 ${i === 4 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bar key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TfCardSkeleton(): ReactNode {
  return (
    <div className="space-y-3 p-4">
      <Bar className="h-5 w-14" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Bar className="h-3.5 w-16" />
          <Bar className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
