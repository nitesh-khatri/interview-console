import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-10 w-60" />

      <Skeleton className="h-12 w-full rounded-md" />

      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-16 w-full rounded-lg"
        />
      ))}
    </div>
  );
}