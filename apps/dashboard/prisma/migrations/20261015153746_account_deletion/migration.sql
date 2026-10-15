-- AlterEnum
ALTER TYPE "account_status" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);
