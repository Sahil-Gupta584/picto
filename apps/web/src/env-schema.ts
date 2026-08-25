import { z } from "zod";

export const serverEnvSchema = z.object({
  TRUEFORGE_BASE_URL: z.string().default("http://localhost:8080/api/v1"),
  TRUEFORGE_API_KEY: z.string().min(1, "TRUEFORGE_API_KEY required"),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  DAYTONA_API_KEY: z.string().optional(),
});
