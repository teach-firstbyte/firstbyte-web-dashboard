import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { createAdminClient, removeLoginByEmail } from "@/lib/supabase/admin";
import { deleteAccountAsOfficer, updateUser } from "@/server/users/mutations";
import { getUserWithTeams, targetIdFor } from "@/server/users/queries";
import { deleteAccountSchema, updateUserSchema } from "@/server/users/schema";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single user with their approved teams.
 *
 * A member always reads their own row, whatever id is in the URL --
 * targetIdFor owns that rule.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const { id } = await params;
    const found = await getUserWithTeams(
      targetIdFor(user, requireId(id, "user")),
    );
    return NextResponse.json(found, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/users/[id]", "Failed to get user");
  }
}

/**
 * Updates a user's name and/or email. A member may only update their own.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateUserSchema);
    const updated = await updateUser(
      targetIdFor(user, requireId(id, "user")),
      input,
    );
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "PUT /api/users/[id]", "Failed to update user");
  }
}

/**
 * Deletes someone else's account, for an officer on the Members page. The body
 * is `{ confirmEmail }`: the person's email, typed again.
 *
 * The rules live in deleteAccountAsOfficer: officers delete members, only a
 * super admin deletes another officer, and nobody deletes themselves here
 * (that is Settings). The account is anonymized, not removed, so past
 * attendance and feedback totals stay the same.
 *
 * The admin client is created first, so a missing service role key fails
 * before anything changes.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const admin = createAdminClient();
    const { id } = await params;
    const input = await parseJsonBody(request, deleteAccountSchema);
    const { email } = await deleteAccountAsOfficer(
      user,
      requireId(id, "user"),
      input,
    );
    const loginRemoved = await removeLoginByEmail(admin, email);
    return NextResponse.json(
      { message: "Account deleted", loginRemoved },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/users/[id]",
      "Failed to delete the account",
    );
  }
}
