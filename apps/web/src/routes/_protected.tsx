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
  RiShieldFlashLine,
} from 'react-icons/ri'
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 font-sans">
      <nav className="border-b border-slate-800 bg-slate-900/90 px-4 sm:px-6 sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          <span
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => router.navigate({ to: '/dashboard' })}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 text-white shadow-md shadow-cyan-500/20">
              <RiShieldFlashLine className="text-lg animate-pulse" />
            </span>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                ForgeMaintainer
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                  Autonomous SaaS
                </span>
              </span>
            </div>
          </span>

          <div className="flex items-center gap-4">
            <Dropdown>
              <Dropdown.Trigger>
                <div className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 transition hover:border-slate-700 focus:outline-none">
                  <Avatar size="sm">
                    {user?.image && (
                      <Avatar.Image src={user.image} alt={displayName} />
                    )}
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  </Avatar>
                  <span className="hidden text-xs font-semibold text-slate-200 sm:block">
                    {displayName}
                  </span>
                </div>
              </Dropdown.Trigger>

              <Dropdown.Popover>
                <Dropdown.Menu aria-label="User menu" className="bg-slate-900 border border-slate-800 text-slate-200">
                  <Dropdown.Item id="identity" textValue={displayName} onAction={() => {}}>
                    <div className="flex items-center gap-3 py-1">
                      <Avatar size="md">
                        {user?.image && (
                          <Avatar.Image src={user.image} alt={displayName} />
                        )}
                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
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
                    <div className="flex items-center gap-2">
                      <RiDashboardLine className="text-base text-cyan-400" />
                      <span>Maintainer Dashboard</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="signout"
                    textValue="Sign out"
                    onAction={handleSignOut}
                  >
                    <div className="flex items-center gap-2 text-red-400">
                      <RiLogoutBoxLine className="text-base" />
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
