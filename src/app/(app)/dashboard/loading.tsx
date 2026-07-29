import { CardsSkeleton, PageHeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeaderSkeleton />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-10" />
          </div>
        ))}
      </div>
      <CardsSkeleton />
    </div>
  );
}
