import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import {
  RiLogoutBoxLine,
  RiMoneyDollarCircleLine,
  RiSettings4Line,
  RiDashboardLine,
} from 'react-icons/ri'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/session'
import { Select, SelectItem, Separator } from '#/components/Select'
import { LogoWithName } from '#/components/Logo'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const router = useRouter()
  const { user } = Route.useRouteContext()

  const handleSignOut = async () => {
    await authClient.signOut()
    router.navigate({ to: '/login' })
  }

  const displayName = user?.name ?? user?.email ?? 'Maintainer'

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] font-sans antialiased">
      <nav className="border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between">
          <span
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => router.navigate({ to: '/dashboard' })}
          >
            <LogoWithName />
            <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface-secondary)] border border-[var(--border)] px-1.5 py-0.5 rounded">
              studio
            </span>
          </span>

          <div className="flex items-center gap-2">
            <Select
              value="profile"
              onChange={(v: string) => {
                if (v === 'dashboard') router.navigate({ to: '/dashboard' })
                else if (v === 'billing') router.navigate({ to: '/billing' })
                else if (v === 'byok') window.dispatchEvent(new CustomEvent('open-byok-settings'))
                else if (v === 'signout') handleSignOut()
              }}
              aria-label="User menu"
            >
              <SelectItem value="profile">{displayName}</SelectItem>
              <SelectItem value="dashboard">
                <span className="flex items-center gap-2"><RiDashboardLine className="text-[var(--accent)]" /> Workspace Dashboard</span>
              </SelectItem>
              <SelectItem value="billing">
                <span className="flex items-center gap-2"><RiMoneyDollarCircleLine className="text-[var(--success)]" /> Billing & Quota</span>
              </SelectItem>
              <SelectItem value="byok">
                <span className="flex items-center gap-2"><RiSettings4Line className="text-[var(--accent)]" /> BYOK & Config</span>
              </SelectItem>
              <Separator />
              <SelectItem value="signout">
                <span className="flex items-center gap-2 text-[var(--danger)]"><RiLogoutBoxLine /> Sign out</span>
              </SelectItem>
            </Select>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
