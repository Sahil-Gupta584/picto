import DodoPayments from 'dodopayments'
import { env } from '#/env'
import { getPlan } from '#/lib/payments/plans'
import type { BillingInterval, PlanId } from '#/lib/payments/plans'

/**
 * Singleton Dodo Payments SDK client.
 *
 * The `dodopayments` package is Node-only (uses `fetch` + `Buffer`), so this
 * module must only ever be imported from server-only code (oRPC handlers and
 * the webhook route). Never import this from a client component.
 */
export const dodo = new DodoPayments({
  bearerToken: env.DODO_PAYMENTS_API_KEY ?? 'placeholder',
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
})

/**
 * Returns the Dodo `product_id` (`prod_...`) configured for a plan + interval.
 * These are static config in #/lib/payments/plans - create the products once in
 * the Dodo dashboard and paste their IDs there.
 */
export function getDodoProductId(planId: PlanId, interval: BillingInterval): string {
  const id = getPlan(planId).dodoProductIds[interval]
  if (!id) {
    throw new Error(
      `Dodo product ID not configured for ${planId}/${interval}. ` +
        `Add it to PLANS in src/lib/payments/plans.ts.`,
    )
  }
  return id
}
