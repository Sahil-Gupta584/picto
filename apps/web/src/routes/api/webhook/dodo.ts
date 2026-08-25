import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { dodo } from '#/lib/payments/dodo'
import type { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks'

async function handle({ request }: { request: Request }) {
  try {
    const body = await request.text()

    // Convert Headers to plain object for dodopayments SDK
    const headersObj: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headersObj[key] = value
    })

    // Verify + parse webhook
    let event: UnwrapWebhookEvent
    try {
      event = dodo.webhooks.unwrap(body, { headers: headersObj })
    } catch (err) {
      console.error('[webhook] signature verification failed:', err)
      return new Response('Invalid signature', { status: 401 })
    }

    console.log('[webhook] received event:', event.type)

    switch (event.type) {
      case 'subscription.active': {
        const sub = event.data
        const userId = String(sub.metadata?.userId ?? '')
        if (!userId) {
          console.warn(
            '[webhook] subscription.active missing userId in metadata',
          )
          break
        }

        const planId = String(sub.metadata?.planId ?? 'starter')
        const interval = String(sub.metadata?.interval ?? 'monthly')

        // Upsert subscription
        const existing = await prisma.subscription.findUnique({
          where: { dodoSubscriptionId: sub.subscription_id },
        })

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: 'active',
              planId,
              billingInterval: interval,
              productId: sub.product_id,
              currentPeriodEnd: sub.next_billing_date
                ? new Date(sub.next_billing_date)
                : null,
              cancelAtNextBilling: sub.cancel_at_next_billing_date ?? false,
            },
          })
        } else {
          await prisma.subscription.create({
            data: {
              userId,
              dodoSubscriptionId: sub.subscription_id,
              dodoCustomerId: sub.customer?.customer_id ?? null,
              productId: sub.product_id,
              status: 'active',
              planId,
              billingInterval: interval,
              currentPeriodEnd: sub.next_billing_date
                ? new Date(sub.next_billing_date)
                : null,
              cancelAtNextBilling: sub.cancel_at_next_billing_date ?? false,
            },
          })
        }
        break
      }

      case 'subscription.renewed': {
        const sub = event.data
        await prisma.subscription.updateMany({
          where: { dodoSubscriptionId: sub.subscription_id },
          data: {
            status: 'active',
            currentPeriodEnd: sub.next_billing_date
              ? new Date(sub.next_billing_date)
              : null,
            cancelAtNextBilling: sub.cancel_at_next_billing_date ?? false,
          },
        })
        break
      }

      case 'subscription.plan_changed': {
        const sub = event.data
        const planId = String(sub.metadata?.planId ?? 'starter')
        const interval = String(sub.metadata?.interval ?? 'monthly')
        await prisma.subscription.updateMany({
          where: { dodoSubscriptionId: sub.subscription_id },
          data: {
            status: 'active',
            planId,
            billingInterval: interval,
            productId: sub.product_id,
            currentPeriodEnd: sub.next_billing_date
              ? new Date(sub.next_billing_date)
              : null,
          },
        })
        break
      }

      case 'subscription.cancelled': {
        const sub = event.data
        await prisma.subscription.updateMany({
          where: { dodoSubscriptionId: sub.subscription_id },
          data: { status: 'cancelled', cancelAtNextBilling: true },
        })
        break
      }

      case 'subscription.expired': {
        const sub = event.data
        await prisma.subscription.updateMany({
          where: { dodoSubscriptionId: sub.subscription_id },
          data: { status: 'expired' },
        })
        break
      }

      case 'subscription.on_hold': {
        const sub = event.data
        await prisma.subscription.updateMany({
          where: { dodoSubscriptionId: sub.subscription_id },
          data: { status: 'on_hold' },
        })
        break
      }

      case 'subscription.failed': {
        const sub = event.data
        await prisma.subscription.updateMany({
          where: { dodoSubscriptionId: sub.subscription_id },
          data: { status: 'on_hold' },
        })
        break
      }

      default:
        console.log('[webhook] unhandled event type:', (event as any).type)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[webhook] error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

export const Route = createFileRoute('/api/webhook/dodo')({
  server: {
    handlers: {
      POST: handle,
    },
  },
})
