import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, Chip, Spinner } from '@heroui/react'
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
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Simple, transparent pricing</h1>
        <p className="text-gray-500 mt-2">
          Choose the plan that fits your needs
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <Card.Header>
              <Card.Title className="text-xl font-bold">Free</Card.Title>
              <Card.Description>Great for getting started</Card.Description>
            </Card.Header>
            <Card.Content className="my-4">
              <div className="text-3xl font-bold">$0</div>
              <p className="text-sm text-gray-500">Forever free</p>
            </Card.Content>
            <Card.Footer>
              <Link to="/dashboard" className="w-full">
                <Button className="w-full" variant="secondary">
                  Current Plan
                </Button>
              </Link>
            </Card.Footer>
          </Card>

          <Card className="p-6 relative border-2 border-indigo-500">
            <div className="absolute top-4 right-4">
              <Chip color="accent">Popular</Chip>
            </div>
            <Card.Header>
              <Card.Title className="text-xl font-bold">Pro</Card.Title>
              <Card.Description>For power users and teams</Card.Description>
            </Card.Header>
            <Card.Content className="my-4">
              <div className="text-3xl font-bold">$10</div>
              <p className="text-sm text-gray-500">per month</p>
            </Card.Content>
            <Card.Footer>
              {isPro ? (
                <Link to="/dashboard" className="w-full">
                  <Button className="w-full" variant="secondary">
                    Manage Subscription
                  </Button>
                </Link>
              ) : (
                <Link to="/dashboard" className="w-full">
                  <Button className="w-full" variant="primary">
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
            </Card.Footer>
          </Card>
        </div>
      )}
    </div>
  )
}
