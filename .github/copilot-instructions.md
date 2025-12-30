# Copilot / Agent Instructions for ClassSched

Purpose: give an AI coding agent the minimal, actionable knowledge to be productive in this repo.

- **Quick start (local)**:
  - Install: `npm install`
  - Dev server: `npm run dev` (Vite runs on port 8080 as configured in `vite.config.ts`)
  - Build: `npm run build`

- **Tech stack (high level)**: Vite + React + TypeScript + Tailwind + shadcn UI (Radix primitives). Uses `@supabase/supabase-js` for backend, `@tanstack/react-query` for data caching.

- **Key integration points**:
  - Supabase client is created in `src/services/supabaseClient.ts` and reads env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - App routes are declared in `src/App.tsx` — add new pages under `src/pages/*` and register routes there.
  - UI primitives and shared components live under `src/components/ui` (shadcn-style wrappers) and `src/components` for layout components like `DashboardLayout.tsx`.

- **Important configs**:
  - `vite.config.ts`: alias `@` -> `./src`, dev server host/port, and uses `lovable-tagger` plugin only in development.
  - `package.json`: scripts: `dev`, `build`, `build:dev`, `preview`, `lint`.

- **Project patterns & conventions (do this same way)**:
  - Component style: prefer small, focused components under `src/components/ui` using `forwardRef`, `cva` for variants, and the `cn` helper. See `src/components/ui/button.tsx` for an example.
  - Pages: group by role/feature under `src/pages` (e.g., `src/pages/admin`, `src/pages/teacher`). Update `src/App.tsx` when adding routes.
  - State & data: use React Query (`@tanstack/react-query`) for server data and caching; create hooks in `src/hooks` if repeated.

- **Dev-only notes**:
  - Vite dev server binds to `::` and port `8080` (accessible on local network).
  - `lovable-tagger` is only included in dev builds (see `vite.config.ts`).

- **What to edit and how** (examples):
  - Add a new page: create `src/pages/admin/MyFeature.tsx`, export default a component, then add a route in `src/App.tsx`.
  - Add a shared UI component: create file under `src/components/ui/` following `button.tsx` pattern (use `cva`, `forwardRef`, export named component).
  - To use supabase: import `{ supabase }` from `src/services/supabaseClient.ts` and use within React Query `useQuery` / `useMutation`.

- **Files to reference frequently**:
  - `package.json` (scripts & deps)
  - `vite.config.ts` (dev server, aliases)
  - `src/App.tsx` (routing)
  - `src/services/supabaseClient.ts` (supabase init)
  - `src/components/ui/button.tsx` (component convention)

- **What an agent should not change without approval**:
  - Global build config (`vite.config.ts`) and aliases.
  - `src/services/supabaseClient.ts` credentials or env var names.

If any section is unclear or you want more examples (routing, a component stub, or a supabase query example), tell me which area to expand. 
