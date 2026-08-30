import { os } from '@orpc/server'
import { ORPCError } from '@orpc/client'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

export interface ORPCContext {
  headers: Headers | Record<string, string>
}

// Base procedure - sets up the request context. Use for public procedures.
export const base = os.$context<ORPCContext>()

// Authed procedure - resolves the current user from the request session and
// injects it into the context. Use for any procedure that needs a logged-in user.
export const authed = base.use(async ({ context, next }) => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })

  if (!session?.user) {
    throw new ORPCError('UNAUTHORIZED')
  }

  return next({
    context: {
      ...context,
      session: session.session,
      user: session.user,
    },
  })
})
