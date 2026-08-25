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
  RiSettingsLine,
  RiUserLine,
  RiPriceTag3Line,
  RiGiftFill,
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
    : (user?.email?.[0] ?? 'U').toUpperCase()

  const displayName = user?.name ?? user?.email ?? 'User'
  const displayEmail = user?.email ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-amber-500 text-white shadow-sm">
              <RiGiftFill className="text-base" />
            </span>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              GiftForm
            </span>
          </span>

          <div className="flex items-center gap-4">
            <Dropdown>
              <Dropdown.Trigger>
                <button className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-gray-100 focus:outline-none">
                  <Avatar size="sm">
                    {user?.image && (
                      <Avatar.Image src={user.image} alt={displayName} />
                    )}
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium text-gray-800 sm:block">
                    {displayName}
                  </span>
                  <svg
                    className="ml-0.5 h-3.5 w-3.5 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </Dropdown.Trigger>

              <Dropdown.Popover>
                <Dropdown.Menu aria-label="User menu">
                  <Dropdown.Item
                    id="identity"
                    textValue={displayName}
                    onAction={() => {}}
                  >
                    <div className="flex items-center gap-3 py-1">
                      <Avatar size="md">
                        {user?.image && (
                          <Avatar.Image src={user.image} alt={displayName} />
                        )}
                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-gray-400">
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
                      <RiDashboardLine className="text-base text-gray-500" />
                      <span>Dashboard</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="pricing"
                    textValue="Pricing"
                    onAction={() => router.navigate({ to: '/pricing' })}
                  >
                    <div className="flex items-center gap-2">
                      <RiPriceTag3Line className="text-base text-gray-500" />
                      <span>Pricing</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="profile"
                    textValue="Profile"
                    onAction={() => router.navigate({ to: '/dashboard' })}
                  >
                    <div className="flex items-center gap-2">
                      <RiUserLine className="text-base text-gray-500" />
                      <span>Profile</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="settings"
                    textValue="Settings"
                    onAction={() => router.navigate({ to: '/dashboard' })}
                  >
                    <div className="flex items-center gap-2">
                      <RiSettingsLine className="text-base text-gray-500" />
                      <span>Settings</span>
                    </div>
                  </Dropdown.Item>

                  <Dropdown.Item
                    id="signout"
                    textValue="Sign out"
                    onAction={handleSignOut}
                  >
                    <div className="flex items-center gap-2 text-red-600">
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
