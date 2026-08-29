import { createFileRoute, Link } from '@tanstack/react-router'
import { Separator } from '@heroui/react'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/Button'
import { Input } from '#/components/Input'
import { RiGoogleFill, RiArrowLeftLine, RiMailSendLine } from 'react-icons/ri'
import { SiDuckduckgo } from 'react-icons/si'

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
    <div className="flex min-h-screen items-center justify-center bg-[#0d0e12] p-4 text-[#ffffff] font-sans antialiased">
      <div className="w-full max-w-sm border border-white/[0.1] bg-[#15171d] p-6 shadow-2xl rounded-2xl">
        <div className="flex flex-col items-start gap-1 pb-4">
          <Link
            to="/dashboard"
            className="mb-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition"
          >
            <RiArrowLeftLine /> Back to dashboard
          </Link>

          <div className="flex items-center gap-2 mt-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#ea580c] text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]">
              <SiDuckduckgo className="text-base" />
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">
                Picto
              </span>
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.2 rounded">
                auth
              </span>
            </div>
          </div>

          <h2 className="mt-3 text-sm font-semibold tracking-tight text-white">
            Sign in to Workspace
          </h2>
          <p className="text-xs text-neutral-400">
            Supervise repositories with autonomous AI maintainers.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          <Button
            type="button"
            className="tembo-btn-secondary w-full justify-center h-9 text-xs font-medium"
            variant="secondary"
            isLoading={isGoogleLoading}
            onClick={handleGoogle}
            startContent={
              !isGoogleLoading && (
                <RiGoogleFill className="text-sm text-rose-400" />
              )
            }
          >
            {isGoogleLoading
              ? 'Connecting...'
              : 'Continue with Google'}
          </Button>

          <div className="flex items-center gap-3 my-1">
            <Separator className="flex-1 bg-white/[0.08]" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
              or email
            </span>
            <Separator className="flex-1 bg-white/[0.08]" />
          </div>

          {magicSent ? (
            <div className="rounded-xl bg-[#0f1015] p-4 text-center text-xs text-emerald-400 border border-emerald-500/25 space-y-1.5 animate-mock-rise">
              <div className="flex justify-center">
                <span className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-base">
                  <RiMailSendLine />
                </span>
              </div>
              <p className="font-semibold text-xs text-white">Check your inbox</p>
              <p className="text-[11px] text-neutral-400">
                We sent a login link to <strong className="text-emerald-400 font-mono">{email}</strong>.
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
                className="tembo-btn-primary w-full justify-center h-9 text-xs shadow-md"
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
