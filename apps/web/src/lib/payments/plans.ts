// ---------------------------------------------------------------------------
// Plan definitions for the GiftForm demo product.
//
// Prices shown here are the DISPLAY prices on the pricing page. The actual
// amounts charged are driven by the Dodo product created server-side (see
// getOrCreateProduct in #/lib/payments/dodo) for each plan + interval.
// ---------------------------------------------------------------------------

export const PLAN_IDS = ['starter', 'pro', 'team'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export const BILLING_INTERVALS = ['monthly', 'annual'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  /** Display price in dollars per month */
  monthlyPrice: number
  /** Display price in dollars per month, billed annually */
  annualPrice: number
  /** Dodo `prod_...` IDs created in the dashboard for each billing interval */
  dodoProductIds: Record<BillingInterval, string>
  /** Feature bullets shown on the pricing page */
  features: string[]
  /** Highlights the middle tier on the pricing page */
  popular: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For trying out GiftForm on a small project.',
    monthlyPrice: 9,
    annualPrice: 7,
    // TODO: create these products in the Dodo dashboard and paste the IDs
    dodoProductIds: { monthly: '', annual: '' },
    popular: false,
    features: [
      'Unlimited feedback entries',
      '100 MB image storage',
      '1 project',
      'Basic analytics',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For teams shipping real products.',
    monthlyPrice: 29,
    annualPrice: 23,
    dodoProductIds: { monthly: '', annual: '' },
    popular: true,
    features: [
      'Unlimited feedback entries',
      '2 GB image storage',
      'Unlimited projects',
      'Screenshot & video capture',
      'Priority support',
      'Advanced analytics',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'For growing teams that need it all.',
    monthlyPrice: 99,
    annualPrice: 79,
    dodoProductIds: { monthly: '', annual: '' },
    popular: false,
    features: [
      'Everything in Pro',
      '20 GB image storage',
      'SSO & team roles',
      'Dedicated success manager',
      'Custom data retention',
    ],
  },
]

export function getPlan(planId: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan) throw new Error(`Unknown plan: ${planId}`)
  return plan
}

export function getPrice(planId: PlanId, interval: BillingInterval): number {
  const plan = getPlan(planId)
  return interval === 'annual' ? plan.annualPrice : plan.monthlyPrice
}

/** Tier ranking used to decide upgrade/downgrade on the pricing page. */
export const PLAN_RANK: Record<PlanId, number> = { starter: 0, pro: 1, team: 2 }
