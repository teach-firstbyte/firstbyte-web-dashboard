import { NextResponse } from "next/server";
import { requireTaskAccessApi } from "@/lib/auth/requireTaskAccessApi";
import { toErrorResponse } from "@/server/http";
import { listTaskOwnerOptions } from "@/server/tasks/queries";

/**
 * The people a task can be assigned to: approved e-board members, by name.
 * For the owner pickers on the meeting page and the New task form.
 */
export async function GET(): Promise<NextResponse> {
  const { user, error } = await requireTaskAccessApi();
  if (error) return error;

  try {
    const owners = await listTaskOwnerOptions(user);
    return NextResponse.json(owners, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/tasks/owners",
      "Failed to get task owners",
    );
  }
}
