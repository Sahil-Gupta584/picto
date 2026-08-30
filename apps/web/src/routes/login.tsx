import { createFileRoute, Link } from '@tanstack/react-router'
import { Separator } from '@heroui/react'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/Button'
import { Input } from '#/components/Input'
import { RiGoogleFill, RiArrowLeftLine, RiMailSendLine } from 'react-icons/ri'
import { LogoWithName } from '#/components/Logo'

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4 text-[var(--foreground)] font-sans antialiased">
      <div className="w-full max-w-sm border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl rounded-2xl">
        <div className="flex flex-col items-start gap-1 pb-4">
          <Link
            to="/dashboard"
            className="mb-2 flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition"
          >
            <RiArrowLeftLine /> Back to dashboard
          </Link>

          <div className="flex items-center gap-2 mt-1">
            <LogoWithName size="lg" />
            <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">
              auth
            </span>
          </div>

          <h2 className="mt-3 text-sm font-semibold tracking-tight text-[var(--foreground)]">
            Sign in to Workspace
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Supervise repositories with autonomous AI maintainers.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          <Button
            type="button"
            className="w-full justify-center h-9 text-xs font-medium"
            variant="secondary"
            isLoading={isGoogleLoading}
            onClick={handleGoogle}
            startContent={
              !isGoogleLoading && (
                <RiGoogleFill className="text-sm text-[var(--danger)]" />
              )
            }
          >
            {isGoogleLoading
              ? 'Connecting...'
              : 'Continue with Google'}
          </Button>

          <div className="flex items-center gap-3 my-1">
            <Separator className="flex-1 bg-[var(--border)]" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted)]">
              or email
            </span>
            <Separator className="flex-1 bg-[var(--border)]" />
          </div>

          {magicSent ? (
            <div className="rounded-xl bg-[var(--surface-secondary)] p-4 text-center text-xs text-[var(--success)] border border-[var(--border)] space-y-1.5">
              <div className="flex justify-center">
                <span className="h-8 w-8 rounded-full bg-[var(--surface-tertiary)] flex items-center justify-center text-base">
                  <RiMailSendLine />
                </span>
              </div>
              <p className="font-semibold text-xs text-[var(--foreground)]">Check your inbox</p>
              <p className="text-[11px] text-[var(--muted)]">
                We sent a login link to <strong className="text-[var(--accent)] font-mono">{email}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3.5">
              <Input
                type="email"
                label="Email Address"
                placeholder="maintainer@example.com"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                required
              />

              <Button
                type="submit"
                className="w-full justify-center h-9 text-xs shadow-md"
                isLoading={isMagicLoading}
              >
                Send Magic Sign-in Link
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
