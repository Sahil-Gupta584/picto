import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Avatar, Dropdown } from '@heroui/react'
import {
  RiDashboardLine,
  RiLogoutBoxLine,
  RiMoneyDollarCircleLine,
  RiSettings4Line,
} from 'react-icons/ri'
import { SiDuckduckgo } from 'react-icons/si'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/session'

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

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (user?.email?.[0] ?? 'M').toUpperCase()

  const displayName = user?.name ?? user?.email ?? 'Maintainer'
  const displayEmail = user?.email ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-[#0d0e12] text-[#ffffff] font-sans antialiased">
      <nav className="border-b border-white/[0.07] bg-[#121318]/95 px-4 sm:px-6 sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between">
          <span
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            onClick={() => router.navigate({ to: '/dashboard' })}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#ea580c] text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]">
              <SiDuckduckgo className="text-sm" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white group-hover:text-neutral-200 transition">
                Picot
              </span>
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.2 rounded">
                studio
              </span>
            </div>
          </span>

          <div className="flex items-center gap-3">
            <Dropdown>
              <Dropdown.Trigger>
                <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#171920] px-2.5 py-1 transition hover:border-white/20 hover:bg-[#1e2029] focus:outline-none shadow-sm">
                  <Avatar size="sm" className="h-6 w-6 text-xs bg-[#242733] text-white border border-white/10">
                    {user?.image && (
                      <Avatar.Image src={user.image} alt={displayName} />
                    )}
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  </Avatar>
                  <span className="hidden text-xs font-medium text-neutral-200 sm:block">
                    {displayName}
                  </span>
                </div>
              </Dropdown.Trigger>

              <Dropdown.Popover>
                <Dropdown.Menu aria-label="User menu" className="bg-[#15171d] border border-white/[0.1] text-white rounded-xl p-1 shadow-2xl backdrop-blur-xl">
                  <Dropdown.Item id="identity" textValue={displayName} onAction={() => {}}>
                    <div className="flex items-center gap-2.5 py-1 px-1">
                      <Avatar size="md" className="h-8 w-8 bg-[#242733] text-white border border-white/10">
                        {user?.image && (
                          <Avatar.Image src={user.image} alt={displayName} />
                        )}
                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {displayName}
                        </p>
                        <p className="truncate text-[11px] text-neutral-400">
                          {displayEmail}
                        </p>
                      </div>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="dashboard"
                    textValue="Dashboard"
                    onAction={() => router.navigate({ to: '/dashboard' })}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium py-1 text-neutral-200 hover:text-white">
                      <RiDashboardLine className="text-sm text-[#1890ff]" />
                      <span>Workspace Dashboard</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="billing"
                    textValue="Billing"
                    onAction={() => router.navigate({ to: '/billing' })}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium py-1 text-neutral-200 hover:text-white">
                      <RiMoneyDollarCircleLine className="text-sm text-emerald-400" />
                      <span>Billing & Quota</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="byok"
                    textValue="BYOK & Config"
                    onAction={() => window.dispatchEvent(new CustomEvent('open-byok-settings'))}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium py-1 text-neutral-200 hover:text-white">
                      <RiSettings4Line className="text-sm text-[#118af3]" />
                      <span>BYOK & Config</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="signout"
                    textValue="Sign out"
                    onAction={handleSignOut}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-rose-400 hover:text-rose-300 py-1">
                      <RiLogoutBoxLine className="text-sm" />
                      <span>Sign out</span>
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
