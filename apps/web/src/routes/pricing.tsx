import { createFileRoute, Link } from '@tanstack/react-router'
import { Spinner } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '#/orpc/client'
import { Button } from '#/components/Button'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  const { data: subscription, isLoading } = useQuery(
    orpc.billing.getSubscription.queryOptions(),
  )

  const isPro = subscription?.status === 'ACTIVE'

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 text-white font-sans antialiased">
      <div className="text-center mb-8 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-white">Simple, transparent pricing</h1>
        <p className="text-xs text-neutral-400">
          Choose the plan that fits your autonomous maintainer workload
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-6 shadow-xl space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-white">Free</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Great for individual open-source repositories</p>
            </div>
            <div className="my-4 space-y-1">
              <div className="text-2xl font-bold font-mono text-white">$0</div>
              <p className="text-xs text-neutral-400">Forever free for single repository</p>
            </div>
            <div className="border-t border-white/[0.08] pt-4">
              <Link to="/dashboard" className="w-full block">
                <Button className="tembo-btn-secondary w-full justify-center" variant="secondary">
                  Current Plan
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[#118af3]/40 bg-[#15171d] p-6 shadow-2xl space-y-4 relative">
            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border bg-[#118af3]/15 text-[#118af3] border-[#118af3]/30 shadow-sm">
                Popular
              </span>
            </div>
            <div className="border-b border-white/[0.08] pb-3">
              <h2 className="text-sm font-semibold tracking-tight text-white">Pro</h2>
              <p className="text-xs text-neutral-400 mt-0.5">For power maintainers and organizations</p>
            </div>
            <div className="my-4 space-y-1">
              <div className="text-2xl font-bold font-mono text-white">$20</div>
              <p className="text-xs text-neutral-400">per month with unlimited sandboxes</p>
            </div>
            <div className="border-t border-white/[0.08] pt-4">
              {isPro ? (
                <Link to="/dashboard" className="w-full block">
                  <Button className="tembo-btn-secondary w-full justify-center" variant="secondary">
                    Manage Subscription
                  </Button>
                </Link>
              ) : (
                <Link to="/billing" className="w-full block">
                  <Button className="tembo-btn-primary w-full justify-center shadow-md" variant="primary">
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
