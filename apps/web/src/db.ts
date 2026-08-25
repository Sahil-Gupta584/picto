import { PrismaClient } from './generated/prisma/client.js'
import { env } from '#/env'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = env.DATABASE_URL || process.env.DATABASE_URL || ''

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool, {
  schema: new URL(connectionString).searchParams.get('schema') ?? 'public',
})

export const prisma = new PrismaClient({ adapter })
