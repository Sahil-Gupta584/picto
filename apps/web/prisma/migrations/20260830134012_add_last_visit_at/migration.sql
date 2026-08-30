-- AlterTable
ALTER TABLE "maintainer_settings" ADD COLUMN     "lastVisitAt" TIMESTAMP(3),
ALTER COLUMN "selectedModel" SET DEFAULT 'google-gemini/gemini-3-5-flash-lite';
