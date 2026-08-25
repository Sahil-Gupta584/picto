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
CREATE UNIQUE INDEX "maintainer_settings_userId_key" ON "maintainer_settings"("userId");

-- AddForeignKey
ALTER TABLE "maintainer_settings" ADD CONSTRAINT "maintainer_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
