import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, Separator } from '@heroui/react'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/Button'
import { Input } from '#/components/Input'
import { RiGoogleFill, RiGiftFill, RiArrowLeftLine } from 'react-icons/ri'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState('')
  const [isMagicLoading, setIsMagicLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsMagicLoading(true)
    try {
      await authClient.signIn.magicLink({
        email,
        callbackURL: '/dashboard',
      })
      setMagicSent(true)
    } catch {
      // ignore
    } finally {
      setIsMagicLoading(false)
    }
  }

  const handleGoogle = async () => {
    setIsGoogleLoading(true)
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      })
    } catch {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-6">
        <Card.Header className="flex-col items-start gap-1 pb-4">
          <Link
            to="/"
            className="mb-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"
          >
            <RiArrowLeftLine /> Back to home
          </Link>

          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-amber-500 text-white shadow-sm">
              <RiGiftFill className="text-lg" />
            </span>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              GiftForm
            </span>
          </div>

          <Card.Title className="mt-2 text-xl font-semibold">
            Sign in to your account
          </Card.Title>
          <Card.Description className="text-sm text-gray-500">
            Welcome back! Choose how you'd like to sign in.
          </Card.Description>
        </Card.Header>

        <Card.Content className="space-y-4 pt-2">
          <Button
            type="button"
            className="w-full justify-center"
            variant="secondary"
            isLoading={isGoogleLoading}
            onClick={handleGoogle}
            startContent={
              !isGoogleLoading && (
                <RiGoogleFill className="text-lg text-red-500" />
              )
            }
          >
            {isGoogleLoading
              ? 'Connecting to Google...'
              : 'Continue with Google'}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              or
            </span>
            <Separator className="flex-1" />
          </div>

          {magicSent ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-800 border border-emerald-200">
              <p className="font-semibold">Check your email!</p>
              <p className="mt-1 text-emerald-700">
                We sent a login link to <strong>{email}</strong>. Click it to
                sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <Input
                type="email"
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                required
              />

              <Button
                type="submit"
                className="w-full justify-center"
                variant="primary"
                isLoading={isMagicLoading}
              >
                Send Magic Link
              </Button>
            </form>
          )}
        </Card.Content>
      </Card>
    </div>
  )
}
