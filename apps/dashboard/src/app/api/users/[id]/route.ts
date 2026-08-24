import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { deleteUser, updateUser } from "@/server/users/mutations";
import { getUserWithTeams, targetIdFor } from "@/server/users/queries";
import { updateUserSchema } from "@/server/users/schema";
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
 * Deletes a user. Officers only -- no targetIdFor here, because self-deletion
 * through this route is not a feature.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const user = await deleteUser(requireId(id, "user"));
    return NextResponse.json(
      { message: "User deleted successfully", user },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/users/[id]",
      "Failed to delete user",
    );
  }
}
