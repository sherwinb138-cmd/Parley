// The buyer's view of one case.
import { CaseView } from "@/components/CaseView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseView caseId={id} role="buyer" />;
}
