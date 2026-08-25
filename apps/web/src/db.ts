import { PrismaClient } from './generated/prisma/client.js'

import { env } from '#/env'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool,
{  
  schema:   new URL(env.DATABASE_URL).searchParams.get('schema') ?? 'public',
})

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma || new PrismaClient({ adapter })

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
