// The browser must never reach this module. `server-only` makes that a build
// error naming the whole import chain, rather than something discovered later
// by grepping the built bundle.
//
// scripts/assert-no-prisma-client-bundle.mjs stays as a second check: it also
// catches @prisma/client imported without going through this file.
import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * The one Prisma client. Nothing outside src/server/ imports it -- an eslint
 * rule enforces that, and the whole point of the data layer is that a query
 * lives beside the rule it implements.
 */
export const prisma = globalForPrisma.prisma || new PrismaClient();

// Kept on globalThis in development so Next's hot reload does not open a new
// connection pool on every edit until Postgres refuses them.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
