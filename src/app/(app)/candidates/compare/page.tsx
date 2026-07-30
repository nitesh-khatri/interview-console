import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getComparison } from "@/lib/pipeline";
import { ComparisonView } from "@/components/candidates/comparison-view";
import { Button } from "@/components/ui/button";

/**
 * Candidate comparison (ticket #17). Reads the ids from the URL so a comparison
 * is shareable with anyone who has an account. `searchParams` is a Promise in
 * this Next.js version.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await getCurrentUser();
  const { ids: raw } = await searchParams;

  const ids = (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 3); // cap at 3

  const candidates = ids.length >= 2 ? getComparison(ids) : [];

  if (candidates.length < 2) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Pick 2 or 3 candidates to compare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select them on the candidates list, then choose Compare.
        </p>
        <Button asChild className="mt-4">
          <Link href="/candidates">Back to candidates</Link>
        </Button>
      </div>
    );
  }

  return <ComparisonView candidates={candidates} />;
}
