import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-10 w-72" />

      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-24 w-full rounded-lg"
        />
      ))}
    </div>
  );
}