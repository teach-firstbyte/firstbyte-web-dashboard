import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

/**
 * Files under src/app that still talk to Prisma directly.
 *
 * This list only shrinks. Each data-layer PR deletes its own entries; when it
 * is empty, delete the constant and the `ignores` line with it.
 *
 * Its job is to stop NEW direct calls appearing during a migration that spans
 * several PRs. An all-or-nothing rule could only land in the last PR, which is
 * after it stops being useful.
 *
 * Note this is a different question from the one scripts/assert-no-prisma-client-bundle.mjs
 * answers. That script exists because client-bundle contamination is
 * *transitive*, so no syntactic rule can catch it. This rule claims something
 * purely local -- "this file contains this import" -- and is sound for it.
 *
 * CAUTION: the brackets of a Next.js dynamic segment must be escaped. These are
 * glob patterns, so an unescaped `[id]` is a character class meaning "one
 * character, either i or d" -- it matches src/app/api/users/i/route.ts and
 * never matches the real path. The failure is silent: the entry simply does
 * nothing and the file reports an error you thought you had allowed.
 */
const UNMIGRATED_PRISMA_CALLERS = [
  "src/app/OfficerDashboard.tsx",
  "src/app/MemberDashboard.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/onboarding/actions.ts",
  "src/app/pending/page.tsx",
  "src/app/settings/actions.ts",
  "src/app/feedback/\\[id\\]/page.tsx",
  "src/app/feedback/\\[id\\]/actions.ts",
  "src/app/api/feedback/route.ts",
  "src/app/api/feedback/\\[id\\]/route.ts",
  "src/app/api/users/route.ts",
  "src/app/api/users/\\[id\\]/route.ts",
  "src/app/api/users/\\[id\\]/status/route.ts",
  "src/app/api/teams/route.ts",
  "src/app/api/teams/\\[id\\]/route.ts",
  "src/app/api/team-members/route.ts",
  "src/app/api/team-members/\\[id\\]/route.ts",
];

const PRISMA_MESSAGE =
  "Pages, route handlers and server actions read and write through src/server/<domain>/. " +
  "A query written here is a business rule nothing else can reuse -- that is how the " +
  "APPROVED-membership scoping ended up written out twice with two different answers.";

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript", "prettier"],
  }),

  // src/app is the edge: auth gates, HTTP shapes, JSX. Not queries.
  {
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    ignores: UNMIGRATED_PRISMA_CALLERS,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/prisma", message: PRISMA_MESSAGE },
            { name: "@/server/db", message: PRISMA_MESSAGE },
            {
              name: "@prisma/client",
              importNames: ["PrismaClient", "Prisma"],
              message:
                "Query builders and payload types belong in src/server/<domain>/select.ts. " +
                "Importing an enum here is fine.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/prisma", "**/server/db"],
              message: PRISMA_MESSAGE,
            },
          ],
        },
      ],
    },
  },

  // Services stay transport-agnostic: no HTTP, no navigation, no props shapes,
  // and above all no session reads. http.ts is the one adapter and the one
  // exception.
  {
    files: ["src/server/**/*.ts"],
    ignores: ["src/server/http.ts", "src/server/props.prisma-sync.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/server",
              message:
                "Services return data and throw ServiceError. Turning that into a " +
                "status code is src/server/http.ts's job.",
            },
            {
              name: "next/navigation",
              message:
                "redirect() and notFound() are page concerns. Throw a ServiceError " +
                "and let the page decide.",
            },
            {
              name: "@/lib/supabase/server",
              message:
                "A service must not read the session. It receives a Viewer from the " +
                "auth gate that already verified one.",
            },
            {
              name: "@/types/dashboard",
              message:
                "types/dashboard.ts is the client props contract. Services derive " +
                "their types from select.ts; props.prisma-sync.ts proves the two agree.",
            },
          ],
        },
      ],
    },
  },

  eslintConfigPrettier,
];

export default eslintConfig;
