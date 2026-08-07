import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listBanks, listQuestions } from "@/lib/queries";
import { QuestionBankView } from "@/components/bank/question-bank-view";
import { canEditQuestionBank } from "@/lib/session";
import type { Question } from "@/lib/types";

export default async function QuestionBankPage() { 
  const user = (await getCurrentUser())!;
  if (!canEditQuestionBank(user.role)) redirect("/dashboard");

  const banks = listBanks();
  const questionsByBank: Record<number, Question[]> = {};
  for (const b of banks) {
    questionsByBank[b.id] = listQuestions(b.id, false);
  }

  return <QuestionBankView banks={banks} questionsByBank={questionsByBank} />;
}
