import { AccountStatus, Role } from "@prisma/client";
import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/server/db";
import { asViewer } from "@/server/viewer";
import { promoteUser } from "./mutations";
import { getUserById } from "./queries";

let nextEmail = 0;

/** Arranges a user row. Tests check results through the services, not this. */
function makeUser(
  role: Role = Role.NORTHEASTERN_STUDENT,
  status: AccountStatus = AccountStatus.APPROVED,
) {
  nextEmail += 1;
  return prisma.user.create({
    data: {
      email: `user-${nextEmail}-${Date.now()}@test.invalid`,
      role,
      status,
    },
  });
}

async function makeViewer(role: Role) {
  return asViewer(await makeUser(role));
}

afterAll(() => prisma.$disconnect());

describe("promoteUser", () => {
  test("a super admin makes a member an officer", async () => {
    const president = await makeViewer(Role.SUPER_ADMIN);
    const member = await makeUser();

    await promoteUser(president, member.id, Role.NORTHEASTERN_ADMIN);

    expect((await getUserById(member.id)).role).toBe(Role.NORTHEASTERN_ADMIN);
  });

  test.each([Role.NORTHEASTERN_STUDENT, Role.NORTHEASTERN_ADMIN])(
    "a super admin makes a %s a super admin",
    async (current) => {
      const president = await makeViewer(Role.SUPER_ADMIN);
      const person = await makeUser(current);

      await promoteUser(president, person.id, Role.SUPER_ADMIN);

      expect((await getUserById(person.id)).role).toBe(Role.SUPER_ADMIN);
    },
  );

  test.each([Role.NORTHEASTERN_ADMIN, Role.NORTHEASTERN_STUDENT])(
    "a %s is refused and the role stays the same",
    async (callerRole) => {
      const caller = await makeViewer(callerRole);
      const member = await makeUser();

      await expect(
        promoteUser(caller, member.id, Role.NORTHEASTERN_ADMIN),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await getUserById(member.id)).role).toBe(
        Role.NORTHEASTERN_STUDENT,
      );
    },
  );

  test.each([
    AccountStatus.ONBOARDING,
    AccountStatus.PENDING,
    AccountStatus.DENIED,
  ])("a %s account is refused and stays a member", async (status) => {
    const president = await makeViewer(Role.SUPER_ADMIN);
    const person = await makeUser(Role.NORTHEASTERN_STUDENT, status);

    await expect(
      promoteUser(president, person.id, Role.NORTHEASTERN_ADMIN),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Only approved accounts can be promoted.",
    });
    expect((await getUserById(person.id)).role).toBe(Role.NORTHEASTERN_STUDENT);
  });

  test("a deleted account is not found", async () => {
    const president = await makeViewer(Role.SUPER_ADMIN);
    const former = await makeUser(
      Role.NORTHEASTERN_STUDENT,
      AccountStatus.DELETED,
    );

    await expect(
      promoteUser(president, former.id, Role.NORTHEASTERN_ADMIN),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getUserById(former.id)).role).toBe(Role.NORTHEASTERN_STUDENT);
  });

  test.each([
    ["an officer", Role.NORTHEASTERN_ADMIN, Role.NORTHEASTERN_ADMIN],
    ["an officer", Role.NORTHEASTERN_ADMIN, Role.NORTHEASTERN_STUDENT],
    ["a super admin", Role.SUPER_ADMIN, Role.NORTHEASTERN_ADMIN],
  ])("%s cannot be moved from %s to %s", async (_, current, requested) => {
    const president = await makeViewer(Role.SUPER_ADMIN);
    const person = await makeUser(current);

    await expect(
      promoteUser(president, person.id, requested),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect((await getUserById(person.id)).role).toBe(current);
  });

  test("a super admin cannot promote themselves", async () => {
    const president = await makeViewer(Role.SUPER_ADMIN);

    await expect(
      promoteUser(president, president.id, Role.SUPER_ADMIN),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  test("an id with no account is not found", async () => {
    const president = await makeViewer(Role.SUPER_ADMIN);

    await expect(
      promoteUser(president, 999_999, Role.NORTHEASTERN_ADMIN),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
