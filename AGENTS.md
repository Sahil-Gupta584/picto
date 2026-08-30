# AGENTS.md - Autonomous Maintainer Codebase Instructions

## Overview
Autonomous GitHub Repository Maintainer built with **TanStack Start**, **oRPC**, **Prisma 7**, and **TrueForge Agent Harness** (`@truefoundry/trueforge-sdk`).

---

## Tech Stack & Architecture

- **Framework**: TanStack Start (Vite + React 19)
- **Router**: TanStack Router (file-based at `apps/web/src/routes/`). Run `npx tsr generate` or `npm run generate-routes` after adding/renaming routes.
- **Server API**: oRPC with Zod validation (`/api/rpc/*` for RPC, `/api/*` for OpenAPI)
- **Data Fetching & State**: TanStack React Query (`@tanstack/react-query`) integrated with oRPC (`import { orpc } from '#/orpc/client'`).
- **Database**: Prisma 7 with `@prisma/adapter-pg` against PostgreSQL (Supabase `schema=maintainer`). Generated client at `src/generated/prisma`.
- **Harness & SDK**: TrueForge (`@truefoundry/trueforge-sdk`) connected to TrueForge Harness Server (`http://localhost:8790`).
- **Auth**: `better-auth` (magic link + Google OAuth). Client instance: `#/lib/auth-client`.
- **UI & Styling**: HeroUI (`@heroui/react`) + Tailwind CSS v4. Icons: `react-icons/ri`.
- **Forms**: `react-hook-form` + `@hookform/resolvers/zod`.

---

## Import Aliases & Conventions

- Both `#/` and `@/` resolve to `./src/`. Prefer `#/` for all internal imports.
  - Example: `import { prisma } from '#/db'`
  - Example: `import { orpc } from '#/orpc/client'`

---

## Agent Instructions & Key Rules

1. **Routing structure**: Never create single dot-nested route files. Use directory-based nested routes under folders instead (e.g. `src/routes/_protected/dashboard.tsx`).
2. **Auth in protected routes**: Under `_protected` pages, do NOT call `authClient.useSession()` or `getSession()`. Access user via `const { user } = Route.useRouteContext()`.
3. **TanStack Query & Mutations**: Use `@tanstack/react-query` (`useQuery`, `useMutation`, `useQueryClient`) with oRPC utilities (`orpc.<router>.<procedure>.queryOptions()` / `orpc.<router>.<procedure>.mutationOptions()`) for ALL client data fetching, reactive caching, auto-refetching, and mutations. Never rely on raw `useEffect` or in-memory array fallbacks.
4. **Database Persistence**: ALL app state (repos, settings, workflows, events) MUST be persisted in Supabase PostgreSQL via Prisma models (`MaintainerRepo`, `MaintainerSettings`, `MaintainerWorkflow`, `MaintainerEvent`). Never store persistent user settings or credentials in global in-memory variables.
5. **Forms**: Any time a feature uses more than 2 input fields, use `react-hook-form` with a proper Zod schema resolver (`@hookform/resolvers/zod`).
6. **Env variables**: Import `env` from `#/env` or process.env appropriately.
7. **UI Components**: Check `src/components/` first for wrappers (e.g. Button, Input, Select). If none exists, import directly from `@heroui/react`.
8. **Route file modularization**: Keep route files focused and concise. If a route file exceeds ~500 lines, extract page-specific sub-components.
9. **TrueForge Agent Workflows**: Ensure all issue investigation, Daytona sandbox test verification, and PR creation workflows enforce TrueForge human checkpoint approvals (`require_approval_for_tools: ["merge_pull_request"]`) before merging.

---

## Key Commands

- `npm run dev` - Start development workspace
- `npx tsr generate` - Regenerate TanStack Router route tree
- `cd apps/web && npx prisma generate` - Regenerate Prisma client
- `cd apps/web && npx prisma migrate deploy` - Deploy named Prisma migrations to PostgreSQL database
