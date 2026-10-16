import { describe, expect, test } from "vitest";
import { promotableRoles } from "./accountPolicy";

const superAdmin = { id: 1, role: "SUPER_ADMIN", status: "APPROVED" };

describe("promotableRoles", () => {
  test("a super admin can make a member an officer or a super admin", () => {
    const member = { id: 2, role: "NORTHEASTERN_STUDENT", status: "APPROVED" };
    expect(promotableRoles(superAdmin, member)).toEqual([
      "NORTHEASTERN_ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("a super admin can make an officer a super admin, and nothing else", () => {
    const officer = { id: 2, role: "NORTHEASTERN_ADMIN", status: "APPROVED" };
    expect(promotableRoles(superAdmin, officer)).toEqual(["SUPER_ADMIN"]);
  });

  test("nobody can promote another super admin", () => {
    const other = { id: 2, role: "SUPER_ADMIN", status: "APPROVED" };
    expect(promotableRoles(superAdmin, other)).toEqual([]);
  });

  test.each([
    ["an officer", "NORTHEASTERN_ADMIN"],
    ["a member", "NORTHEASTERN_STUDENT"],
  ])("%s cannot promote anyone", (_, role) => {
    const actor = { id: 1, role, status: "APPROVED" };
    const member = { id: 2, role: "NORTHEASTERN_STUDENT", status: "APPROVED" };
    expect(promotableRoles(actor, member)).toEqual([]);
  });

  test.each(["ONBOARDING", "PENDING", "DENIED", "DELETED"])(
    "a %s account cannot be promoted",
    (status) => {
      const member = { id: 2, role: "NORTHEASTERN_STUDENT", status };
      expect(promotableRoles(superAdmin, member)).toEqual([]);
    },
  );

  test("a role it does not know offers nothing", () => {
    const odd = { id: 2, role: "SOMETHING_NEW", status: "APPROVED" };
    expect(promotableRoles(superAdmin, odd)).toEqual([]);
  });
});
