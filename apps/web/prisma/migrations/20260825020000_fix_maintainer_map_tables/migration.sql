-- CreateTable
CREATE TABLE "maintainer_repo" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sandboxProvider" TEXT NOT NULL DEFAULT 'TrueForge Harness Sandbox',
    "autoFixEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintainer_repo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintainer_workflow" (
    "id" TEXT NOT NULL,
    "issueUrl" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'investigating',
    "state" TEXT NOT NULL DEFAULT 'open',
    "author" TEXT NOT NULL DEFAULT 'user',
    "rootCause" TEXT,
    "affectedFiles" JSONB,
    "riskLevel" TEXT DEFAULT 'low',
    "recommendation" TEXT,
    "prNumber" INTEGER,
    "branch" TEXT,
    "diff" TEXT,
    "prSummary" TEXT,
    "testLog" TEXT,
    "testPassed" BOOLEAN NOT NULL DEFAULT false,
    "trueforgeSessionId" TEXT,
    "toolCallId" TEXT,
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintainer_workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintainer_event" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintainer_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintainer_repo_fullName_key" ON "maintainer_repo"("fullName");

-- CreateIndex
CREATE INDEX "maintainer_workflow_repoFullName_idx" ON "maintainer_workflow"("repoFullName");

-- CreateIndex
CREATE INDEX "maintainer_event_workflowId_idx" ON "maintainer_event"("workflowId");

-- AddForeignKey
ALTER TABLE "maintainer_workflow" ADD CONSTRAINT "maintainer_workflow_repoFullName_fkey" FOREIGN KEY ("repoFullName") REFERENCES "maintainer_repo"("fullName") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintainer_event" ADD CONSTRAINT "maintainer_event_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "maintainer_workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
