/*
  Warnings:

  - You are about to drop the `MaintainerEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MaintainerRepo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MaintainerWorkflow` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MaintainerEvent" DROP CONSTRAINT "MaintainerEvent_workflowId_fkey";

-- DropForeignKey
ALTER TABLE "maintainer_workflow" DROP CONSTRAINT "maintainer_workflow_repoFullName_fkey";

-- AlterTable
ALTER TABLE "maintainer_workflow" ADD COLUMN     "executionMode" TEXT DEFAULT 'DIRECT',
ADD COLUMN     "prCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prDecisionReasoning" TEXT;

-- DropTable
DROP TABLE "MaintainerEvent";

-- DropTable
DROP TABLE "MaintainerRepo";

-- DropTable
DROP TABLE "MaintainerWorkflow";

-- AddForeignKey
ALTER TABLE "maintainer_workflow" ADD CONSTRAINT "maintainer_workflow_repoFullName_fkey" FOREIGN KEY ("repoFullName") REFERENCES "maintainer_repo"("fullName") ON DELETE RESTRICT ON UPDATE CASCADE;
