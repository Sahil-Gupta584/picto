import { z } from 'zod'
import { prisma } from '#/db'
import { authed, base } from '#/orpc/middleware'
import type { BillingInterval, PlanId } from '#/lib/payments/plans'
import { dodo, getDodoProductId } from '#/lib/payments/dodo'
import { PLANS } from '#/lib/payments/plans'
import { env } from '#/env'

// Get current subscription for the user
export const getSubscription = authed
  .input(z.void())
  .handler(async ({ context }) => {
    const sub = await prisma.subscription.findFirst({
      where: { userId: context.user.id, status: { in: ['active', 'on_hold'] } },
      orderBy: { createdAt: 'desc' },
    })
    return sub ?? null
  })

// Get all plans (for pricing display — no product IDs needed client-side)
export const getPlans = base
  .input(z.void())
  .handler(async () => {
    return PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      monthlyPrice: p.monthlyPrice,
      annualPrice: p.annualPrice,
      features: p.features,
      popular: p.popular,
    }))
  })

// Create a Dodo checkout session and return the hosted checkout URL
export const createCheckout = authed
  .input(
    z.object({
      planId: z.enum(['starter', 'pro', 'team']),
      interval: z.enum(['monthly', 'annual']),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (!env.DODO_PAYMENTS_API_KEY) {
      throw new Error('Dodo Payments is not configured. Add DODO_PAYMENTS_API_KEY to .env.local')
    }

    const productId = getDodoProductId(input.planId as PlanId, input.interval as BillingInterval)

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: context.user.email,
        name: context.user.name ?? undefined,
      },
      subscription_data: { trial_period_days: 7 },
      billing_address: { country: 'US' },
      // return_url is the single redirect URL (success or cancel)
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        userId: context.user.id,
        planId: input.planId,
        interval: input.interval,
      },
    })

    return { url: session.checkout_url ?? null, sessionId: session.session_id }
  })

// Cancel the active subscription at period end
export const cancelSubscription = authed
  .input(z.void())
  .handler(async ({ context }) => {
    const sub = await prisma.subscription.findFirst({
      where: { userId: context.user.id, status: { in: ['active', 'on_hold'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (!sub) throw new Error('No active subscription')

    await dodo.subscriptions.update(sub.dodoSubscriptionId, {
      cancel_at_next_billing_date: true,
    })

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtNextBilling: true },
    })

    return { success: true }
  })

// Resume (un-cancel) the subscription
export const resumeSubscription = authed
  .input(z.void())
  .handler(async ({ context }) => {
    const sub = await prisma.subscription.findFirst({
      where: { userId: context.user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })
    if (!sub) throw new Error('No active subscription')

    await dodo.subscriptions.update(sub.dodoSubscriptionId, {
      cancel_at_next_billing_date: false,
    })

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtNextBilling: false, status: 'active' },
    })

    return { success: true }
  })
