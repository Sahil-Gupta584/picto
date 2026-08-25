-- CreateTable
CREATE TABLE "MaintainerRepo" (
    "id" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "githubToken" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintainerRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintainerWorkflow" (
    "id" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "author" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'investigating',
    "rootCause" TEXT,
    "affectedFiles" JSONB,
    "recommendation" TEXT,
    "riskLevel" TEXT DEFAULT 'low',
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "prSummary" TEXT,
    "branch" TEXT,
    "diff" TEXT,
    "testPassed" INTEGER NOT NULL DEFAULT 0,
    "testLog" TEXT,
    "trueforgeSessionId" TEXT,
    "toolCallId" TEXT,
    "threadId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintainerWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintainerEvent" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintainerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintainerRepo_repoFullName_key" ON "MaintainerRepo"("repoFullName");

-- CreateIndex
CREATE INDEX "MaintainerRepo_userId_idx" ON "MaintainerRepo"("userId");

-- CreateIndex
CREATE INDEX "MaintainerWorkflow_repoFullName_idx" ON "MaintainerWorkflow"("repoFullName");

-- CreateIndex
CREATE INDEX "MaintainerWorkflow_issueNumber_idx" ON "MaintainerWorkflow"("issueNumber");

-- CreateIndex
CREATE INDEX "MaintainerWorkflow_status_idx" ON "MaintainerWorkflow"("status");

-- CreateIndex
CREATE INDEX "MaintainerEvent_workflowId_idx" ON "MaintainerEvent"("workflowId");

-- AddForeignKey
ALTER TABLE "MaintainerEvent" ADD CONSTRAINT "MaintainerEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "MaintainerWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
