-- AlterTable
ALTER TABLE "account" ADD COLUMN     "issuer" TEXT;

-- CreateTable
CREATE TABLE "maintainer_repo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "webhookId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sandboxProvider" TEXT NOT NULL DEFAULT 'TrueForge Harness Sandbox',
    "autoFixEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintainer_repo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintainer_comment" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "issueNumber" INTEGER,
    "githubCommentId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPRReady" BOOLEAN NOT NULL DEFAULT false,
    "prNumber" INTEGER,
    "shouldNotify" BOOLEAN NOT NULL DEFAULT false,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "aiReasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintainer_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintainer_workflow" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "issueUrl" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'investigating',
    "state" TEXT NOT NULL DEFAULT 'open',
    "author" TEXT NOT NULL DEFAULT 'user',
    "rootCause" TEXT,
    "affectedFiles" JSONB,
    "recommendation" TEXT,
    "riskLevel" TEXT DEFAULT 'low',
    "prNumber" INTEGER,
    "branch" TEXT,
    "diff" TEXT,
    "prSummary" TEXT,
    "testLog" TEXT,
    "testPassed" BOOLEAN NOT NULL DEFAULT false,
    "prDecisionReasoning" TEXT,
    "executionMode" TEXT DEFAULT 'DIRECT',
    "prCreated" BOOLEAN NOT NULL DEFAULT false,
    "directPr" BOOLEAN NOT NULL DEFAULT false,
    "directPrReasoning" TEXT,
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

-- CreateTable
CREATE TABLE "maintainer_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "geminiApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "openaiApiKey" TEXT,
    "githubToken" TEXT,
    "selectedModel" TEXT NOT NULL DEFAULT 'google/gemini-3.1-flash-lite',
    "trueforgeBaseUrl" TEXT NOT NULL DEFAULT 'http://localhost:8790',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintainer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintainer_repo_fullName_key" ON "maintainer_repo"("fullName");

-- CreateIndex
CREATE INDEX "maintainer_repo_userId_idx" ON "maintainer_repo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "maintainer_comment_githubCommentId_key" ON "maintainer_comment"("githubCommentId");

-- CreateIndex
CREATE INDEX "maintainer_comment_repoId_issueNumber_idx" ON "maintainer_comment"("repoId", "issueNumber");

-- CreateIndex
CREATE INDEX "maintainer_comment_shouldNotify_notified_idx" ON "maintainer_comment"("shouldNotify", "notified");

-- CreateIndex
CREATE INDEX "maintainer_workflow_repoId_idx" ON "maintainer_workflow"("repoId");

-- CreateIndex
CREATE INDEX "maintainer_event_workflowId_idx" ON "maintainer_event"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "maintainer_settings_userId_key" ON "maintainer_settings"("userId");

-- AddForeignKey
ALTER TABLE "maintainer_repo" ADD CONSTRAINT "maintainer_repo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintainer_comment" ADD CONSTRAINT "maintainer_comment_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "maintainer_repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintainer_workflow" ADD CONSTRAINT "maintainer_workflow_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "maintainer_repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintainer_event" ADD CONSTRAINT "maintainer_event_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "maintainer_workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintainer_settings" ADD CONSTRAINT "maintainer_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
