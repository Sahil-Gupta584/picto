CODEBASE OVERVIEW

This is "driz", a full-stack web application built with TanStack Start (React SSR). The stack is TypeScript throughout. Package manager is npm.


TECH STACK

Framework: TanStack Start (Vite + React 19)
Router: TanStack Router (file-based at src/routes/). Never edit src/routeTree.gen.ts manually. Run npm run generate-routes after adding/renaming routes.
Server API: oRPC with Zod validation (/api/rpc/* for RPC, /api/* for OpenAPI)
Database: Prisma 7 with @prisma/adapter-pg against PostgreSQL. Client at src/generated/prisma.
Auth: better-auth (magic link + Google OAuth). Client instance: #/lib/auth-client.
Payments: Dodo Payments (hosted checkout redirect + webhook signature verification).
UI & Styling: HeroUI (@heroui/react) + Tailwind CSS v4. Icons: react-icons/ri.
Forms: react-hook-form + @hookform/resolvers/zod.


IMPORT ALIASES

Both #/* and @/* resolve to ./src/*. Prefer #/ for all internal imports.
Examples:
  import { prisma } from '#/db'
  import { env } from '#/env'


AGENT INSTRUCTIONS & KEY CONVENTIONS

1. Routing structure: Never create single dot-nested route files (e.g. settings.dashboard.tsx or dashboard.settings.tsx). Use flat directory-based nested routes under folders instead (e.g. src/routes/_protected/settings.tsx or src/routes/_protected/dashboard.tsx).
2. Auth in protected routes: Under _protected pages, do NOT call authClient.useSession() or getSession(). The user object is already provided in the page context by _protected.tsx. Access it via const { user } = Route.useRouteContext().
3. Forms: Any time a feature uses more than 2 input fields, always use react-hook-form with a proper Zod schema resolver (@hookform/resolvers/zod). Place the Zod schema at the top of the component file and infer the TypeScript type using z.infer<typeof schema>.
4. Env variables: Import env from '#/env' — never use process.env directly.
5. UI Components: Check src/components/ first for wrappers (e.g. Button, Input, Select). If none exists, import directly from @heroui/react.
6. Route file modularization: Keep route files focused and concise. Do not overcrowd a single route file by declaring multiple sub-components inline. If a route file exceeds ~500 lines, convert it to a folder (e.g. rename dashboard.tsx to dashboard/index.tsx) and extract page-specific sub-components or utilities into a local subfolder (e.g. dashboard/-components/button.tsx).


COMMANDS

npm run dev — Start development server (port 3000)
npm run generate-routes — Regenerate TanStack Router route tree
npm run db:generate — Regenerate Prisma client
npm run db:migrate — Create and apply database migration
npm run db:push — Push schema directly to database
npm run build — Production build
npm run lint / npm run check — Run linter and typecheck
