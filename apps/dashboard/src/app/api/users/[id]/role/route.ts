import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { assertMayPromote, promoteUser } from "@/server/users/mutations";
import { promoteUserSchema } from "@/server/users/schema";
import { requireId } from "@/server/validation";

/**
 * Promotes a person, for a super admin on the Members page. The body is
 * `{ role }`: NORTHEASTERN_ADMIN or SUPER_ADMIN.
 *
 * requireOfficerApi turns members away. assertMayPromote then turns away
 * officers who are not super admins, before the body is read, so they get 403
 * whatever they sent. The rest of the rules live in promoteUser.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireOfficerApi();
  if (error) return error;

  try {
    assertMayPromote(user);
    const { id } = await params;
    const { role } = await parseJsonBody(request, promoteUserSchema);
    const promoted = await promoteUser(user, requireId(id, "user"), role);
    return NextResponse.json(promoted, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PATCH /api/users/[id]/role",
      "Failed to change the role",
    );
  }
}
