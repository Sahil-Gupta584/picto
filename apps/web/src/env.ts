import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    DODO_PAYMENTS_API_KEY: z.string().optional(),
    DODO_PAYMENTS_WEBHOOK_KEY: z.string().optional(),
    DODO_PAYMENTS_ENVIRONMENT: z.enum(['test_mode', 'live_mode']).default('test_mode'),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  },

  clientPrefix: 'VITE_',

  client: {
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_SENTRY_ORG: z.string().optional(),
    VITE_SENTRY_PROJECT: z.string().optional(),
  },

  runtimeEnv: {
    ...import.meta.env,
    ...process.env,
  },

  emptyStringAsUndefined: true,
})
