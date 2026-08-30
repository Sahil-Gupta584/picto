import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Select, Label, ListBox, Separator, Avatar } from '@heroui/react'
import {
  RiLogoutBoxLine,
  RiMoneyDollarCircleLine,
  RiSettings4Line,
  RiDashboardLine,
} from 'react-icons/ri'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/session'
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
  const displayEmail = user?.email ?? ''
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

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
              aria-label="User menu"
              value="profile"
              onChange={(v: any) => {
                if (v === 'dashboard') router.navigate({ to: '/dashboard' })
                else if (v === 'billing') router.navigate({ to: '/billing' })
                else if (v === 'byok') window.dispatchEvent(new CustomEvent('open-byok-settings'))
                else if (v === 'signout') handleSignOut()
              }}
            >
              <Select.Trigger>
                <Select.Value>
                  {() => (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="h-6 w-6 text-xs bg-[var(--surface-tertiary)] border border-[var(--border)]">
                        {user?.image && <Avatar.Image src={user.image} alt={displayName} />}
                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                      </Avatar>
                      <span className="hidden sm:block text-xs font-medium">{displayName}</span>
                    </div>
                  )}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {/* Identity section */}
                  <ListBox.Item id="profile" textValue={displayName} isDisabled>
                    <div className="flex items-center gap-2.5 py-1">
                      <Avatar size="md" className="h-8 w-8 bg-[var(--surface-tertiary)] border border-[var(--border)]">
                        {user?.image && <Avatar.Image src={user.image} alt={displayName} />}
                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--foreground)] truncate">{displayName}</p>
                        <p className="text-[11px] text-[var(--muted)] truncate">{displayEmail}</p>
                      </div>
                    </div>
                  </ListBox.Item>
                  <Separator />
                  <ListBox.Item id="dashboard" textValue="Workspace Dashboard">
                    <span className="flex items-center gap-2 text-xs py-0.5">
                      <RiDashboardLine className="text-[var(--accent)]" /> Workspace Dashboard
                    </span>
                  </ListBox.Item>
                  <ListBox.Item id="billing" textValue="Billing & Quota">
                    <span className="flex items-center gap-2 text-xs py-0.5">
                      <RiMoneyDollarCircleLine className="text-[var(--success)]" /> Billing & Quota
                    </span>
                  </ListBox.Item>
                  <ListBox.Item id="byok" textValue="BYOK & Config">
                    <span className="flex items-center gap-2 text-xs py-0.5">
                      <RiSettings4Line className="text-[var(--accent)]" /> BYOK & Config
                    </span>
                  </ListBox.Item>
                  <Separator />
                  <ListBox.Item id="signout" textValue="Sign out">
                    <span className="flex items-center gap-2 text-xs py-0.5 text-[var(--danger)]">
                      <RiLogoutBoxLine /> Sign out
                    </span>
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
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
