// GET  /api/cases          -> list of cases
// POST /api/cases          -> import a PayPal dispute as a case. Body: { disputeId?: string }
//                             Without an ID it imports the newest dispute that is not in Parley yet.
import { errorResponse } from "@/lib/api";
import { syncCaseFromPayPal } from "@/lib/case/import";
import { getCaseByDispute, listCases } from "@/lib/db/cases";
import { listDisputes } from "@/lib/paypal/disputes";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ cases: await listCases() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "import", 10);
  if (limited) return limited;
  try {
    const body = (await request.json().catch(() => ({}))) as { disputeId?: string };
    let disputeId = body.disputeId?.trim().toUpperCase();

    if (disputeId && !/^PP-[A-Z0-9-]{5,40}$/.test(disputeId)) {
      return Response.json({ error: "That does not look like a PayPal case ID. It should look like PP-R-ABC-12345678." }, { status: 400 });
    }
    if (!disputeId) {
      for (const d of await listDisputes()) {
        if (!(await getCaseByDispute(d.dispute_id))) {
          disputeId = d.dispute_id;
          break;
        }
      }
      if (!disputeId) {
        return Response.json(
          { error: "No new PayPal dispute found. A new dispute can take a few minutes to appear; entering its case ID works at once." },
          { status: 404 }
        );
      }
    }

    const { caseRow, added } = await syncCaseFromPayPal(disputeId);
    return Response.json({ id: caseRow.id, paypal_dispute_id: caseRow.paypal_dispute_id, evidence_added: added });
  } catch (e) {
    return errorResponse(e);
  }
}
