import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { excuseSelf, withdrawExcuse } from "@/server/attendance/mutations";
import { excuseSchema } from "@/server/attendance/schema";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * "I can't make it": excuses the caller from a meeting that hasn't started.
 *
 * The subject is always the caller, like check-in. There is no userId in the
 * body, so nobody can excuse somebody else this way.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, excuseSchema);
    const record = await excuseSelf(user, requireId(id, "meeting"), input);
    return NextResponse.json(record, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "POST /api/meetings/[id]/excuse",
      "Failed to save that",
    );
  }
}

/** Takes back the caller's own excuse, before the meeting starts. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const { id } = await params;
    await withdrawExcuse(user, requireId(id, "meeting"));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/meetings/[id]/excuse",
      "Failed to undo that",
    );
  }
}
