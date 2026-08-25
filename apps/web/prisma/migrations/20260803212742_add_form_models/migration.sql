-- CreateTable
CREATE TABLE "form" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preset" TEXT NOT NULL DEFAULT 'amazon',
    "fields" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_userId_idx" ON "form"("userId");

-- CreateIndex
CREATE INDEX "form_submission_formId_idx" ON "form_submission"("formId");

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
