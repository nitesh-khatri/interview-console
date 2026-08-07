import { getCurrentUser } from "@/lib/auth";
import { getCandidateSummaries } from "@/lib/pipeline";
import { CandidatesView } from "@/components/candidates/candidates-view";

export default async function CandidatesPage() {
  const user = (await getCurrentUser())!;
  const candidates = getCandidateSummaries();
  return (
    <CandidatesView
      candidates={candidates}
      currentUserId={user.id}
      role={user.role}
    />
  );
}
