import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholders shown while a server page is fetching. They mirror the real
 * layout's shape so the page doesn't jump when the content arrives.
 */

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div data-testid="table-skeleton" className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div
      data-testid="cards-skeleton"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-4 h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-9 w-32" />
    </div>
  );
}
