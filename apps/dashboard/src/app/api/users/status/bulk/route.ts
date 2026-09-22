import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { setAccountStatusBulk } from "@/server/users/mutations";
import { bulkAccountStatusSchema } from "@/server/users/schema";

/**
 * Decides several accounts at once. Each id succeeds or fails independently --
 * see setAccountStatusBulk -- so the response is always 200 with a per-id
 * breakdown rather than an all-or-nothing error.
 */
export async function PATCH(request: Request) {
  const { user: officer, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { userIds, status } = await parseJsonBody(
      request,
      bulkAccountStatusSchema,
    );
    const result = await setAccountStatusBulk(officer, userIds, status);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PATCH /api/users/status/bulk",
      "Failed to update account statuses",
    );
  }
}
