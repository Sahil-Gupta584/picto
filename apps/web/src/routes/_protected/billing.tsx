import { createFileRoute } from '@tanstack/react-router'
import { Card, Chip, Spinner } from '@heroui/react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { orpc } from '#/orpc/client'
import { Button } from '#/components/Button'

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
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Billing & Subscription
      </h1>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : (
        <Card className="p-6">
          <Card.Header className="flex justify-between items-center pb-4">
            <div>
              <Card.Title className="text-lg font-semibold">
                Current Plan
              </Card.Title>
              <Card.Description className="text-sm text-gray-500">
                Manage your subscription and billing details
              </Card.Description>
            </div>
            <Chip color={isPro ? 'accent' : 'default'}>
              {isPro ? 'PRO' : 'FREE'}
            </Chip>
          </Card.Header>

          <Card.Content className="space-y-4 py-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {isPro ? '$10' : '$0'}
              </span>
              <span className="text-gray-500">/ month</span>
            </div>

            <p className="text-sm text-gray-600">
              {isPro
                ? 'You are on the Pro plan with unlimited access to features.'
                : 'Upgrade to Pro to unlock unlimited forms and advanced features.'}
            </p>
          </Card.Content>

          <Card.Footer>
            {!isPro && (
              <Button
                variant="primary"
                isLoading={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate({ planId: 'pro' })}
              >
                Upgrade to Pro
              </Button>
            )}
          </Card.Footer>
        </Card>
      )}
    </div>
  )
}
