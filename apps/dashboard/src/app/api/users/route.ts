import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { createUser } from "@/server/users/mutations";
import { listUsers } from "@/server/users/queries";
import { createUserSchema } from "@/server/users/schema";

/**
 * Gets every account, including those still in the review queue.
 */
export async function GET(): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    return NextResponse.json(await listUsers(), { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/users", "Failed to get users");
  }
}

/**
 * Creates a new user.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, createUserSchema);
    return NextResponse.json(await createUser(input), { status: 201 });
  } catch (e) {
    return toErrorResponse(e, "POST /api/users", "Failed to create user");
  }
}
