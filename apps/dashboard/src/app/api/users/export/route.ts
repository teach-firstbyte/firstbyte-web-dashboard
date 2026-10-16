import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { toErrorResponse } from "@/server/http";
import { listMembersForExport } from "@/server/users/queries";

/**
 * The rows behind the members CSV export, as JSON.
 *
 * JSON, not a CSV response: the officer picks the team, columns and order in
 * the dialog, and the browser writes the file from these rows (see
 * lib/memberExport.ts). A server-built CSV would need every one of those
 * choices sent as query params, plus a Content-Disposition filename to
 * sanitize, and an <a href> that 403s navigates the officer to a raw JSON body.
 */
export async function GET(): Promise<NextResponse> {
  const { user, error } = await requireOfficerApi();
  if (error) return error;

  try {
    return NextResponse.json(await listMembersForExport(user), {
      status: 200,
    });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/users/export",
      "Failed to load members for export",
    );
  }
}
