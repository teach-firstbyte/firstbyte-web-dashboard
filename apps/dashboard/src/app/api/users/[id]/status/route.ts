import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { setAccountStatus } from "@/server/users/mutations";
import { accountStatusSchema } from "@/server/users/schema";
import { requireId } from "@/server/validation";

/**
 * Decides an account: approve it, deny it, or put it back in the queue.
 *
 * The self-decision guard and the last-officer guard both live in
 * setAccountStatus, so any future caller inherits them.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user: officer, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const { status } = await parseJsonBody(request, accountStatusSchema);
    const updated = await setAccountStatus(
      officer,
      requireId(id, "user"),
      status,
    );
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PATCH /api/users/[id]/status",
      "Failed to update account status",
    );
  }
}
