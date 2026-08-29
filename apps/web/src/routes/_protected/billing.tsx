import { createFileRoute } from '@tanstack/react-router'
import { Spinner } from '@heroui/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { orpc } from '#/orpc/client'
import { Button } from '#/components/Button'
import { RiShieldCheckLine, RiFlashlightFill } from 'react-icons/ri'

export const Route = createFileRoute('/_protected/billing')({
  component: BillingPage,
})

function BillingPage() {
  const { data: subscription, isLoading } = useQuery(
    orpc.billing.getSubscription.queryOptions(),
  )

  const checkoutMutation = useMutation(
    orpc.billing.createCheckout.mutationOptions({
      onSuccess: (data: any) => {
        if (data?.url) {
          window.location.href = data.url
        }
      },
    }),
  )

  const isPro = subscription?.status === 'ACTIVE'

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4 text-white font-sans antialiased">
      <div className="space-y-0.5">
        <h1 className="text-sm font-semibold tracking-tight text-white">
          Workspace Billing & Plan
        </h1>
        <p className="text-xs text-neutral-400">
          Manage autonomous maintainer execution quotas, sandbox compute, and tier access.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-white/[0.08]">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                <RiFlashlightFill className="text-[#118af3]" /> Current Subscription
              </div>
              <p className="text-xs text-neutral-400">
                Maintainer agents and repository quota allocation
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-sm">
              {isPro ? 'PRO TIER' : 'FREE TIER'}
            </span>
          </div>

          <div className="space-y-3 py-1">
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-white">
                {isPro ? '$20' : '$0'}
              </span>
              <span className="text-xs text-neutral-500">/ month</span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-[#0f1015] p-3.5 rounded-xl border border-white/[0.06]">
              {isPro
                ? 'Your workspace includes unlimited repository automation, continuous Daytona sandboxing, and priority model routing.'
                : 'Free tier includes basic triage for 1 connected repository. Upgrade to Pro for unlimited repo maintainers and automatic PR verification.'}
            </p>
          </div>

          <div className="border-t border-white/[0.08] pt-4 flex justify-end">
            {!isPro && (
              <Button
                className="tembo-btn-primary h-8 px-4 text-xs font-bold shadow-md"
                isLoading={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate({ planId: 'pro' })}
                startContent={<RiShieldCheckLine className="text-sm" />}
              >
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
