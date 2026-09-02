# Esker Operations

Fleet, plant and compliance operations for Esker Readymix.
Next.js (App Router) + Supabase.

**Progress**
- **Phase 1 — done.** Authentication + role-aware dashboard; verified each of the
  5 roles sees only what Row Level Security allows.
- **Phase 2 — done.** Asset management: add / edit / void screens for vehicles,
  plant and trailers (Transport Manager / Admin only), driver & operator
  assignment, and a scannable QR code per asset that resolves to its record.

- Architecture blueprint: [`docs/architecture-v1.md`](docs/architecture-v1.md)
- Database schema (already applied in Supabase): [`supabase/schema.sql`](supabase/schema.sql)

## Roles

`driver`, `plant_operator`, `mechanic`, `transport_manager`, `admin` — stored in
the `public.user_roles` table (a user can hold more than one). `admin` and
`transport_manager` count as "manager" (mirrors `public.is_manager()`).

## Prerequisites

- Node.js 20+ (installed: v24)
- A Supabase project with `supabase/schema.sql` already run against it

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables** — copy the example and fill it in:

   ```bash
   cp .env.local.example .env.local
   ```

   Get both values from Supabase → Project Settings → API:

   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon` / `public` key

   `.env.local` is gitignored and never committed.

3. **Create the 5 test users** in Supabase → Authentication → Users → *Add user*
   (tick **Auto Confirm User**):

   | Email | Password (example) |
   |---|---|
   | `driver@esker.test` | `Test1234!` |
   | `operator@esker.test` | `Test1234!` |
   | `mechanic@esker.test` | `Test1234!` |
   | `manager@esker.test` | `Test1234!` |
   | `admin@esker.test` | `Test1234!` |

4. **Run the seed** — Supabase → SQL Editor → paste
   [`supabase/seed.sql`](supabase/seed.sql) → Run. This links each auth user to a
   `public.users` profile, assigns one role each, and adds a little sample fleet
   data so the access differences are visible. Re-running it is safe.

   To undo: run [`supabase/seed_teardown.sql`](supabase/seed_teardown.sql).

5. **Start the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 — you'll be redirected to `/login`.

## Testing role isolation

Sign in as each test user in turn. On the dashboard:

- The header shows the role badge(s) that user holds.
- Each role gets a different **home panel** (Driver → My Vehicle, Mechanic →
  Workshop queue, Manager → Fleet Overview, etc.).
- The **Data access check** card runs live `COUNT` queries as that user, through
  RLS. Compare "rows visible" to "expected". Key differences with the seed data:

  | Table | driver / operator | mechanic | manager / admin |
  |---|---|---|---|
  | `vehicles`, `plant`, `faults`, `compliance_items` | all | all | all |
  | `labour_entries` | 0 | own only | all |
  | `parts_used` | 0 | all | all |
  | `audit_log` | 0 | 0 | all |
  | `users`, `user_roles` | own row only | own row only | all |

  RLS never returns an *error* on a blocked read — it silently returns 0 rows.
  That's expected and is the whole point of enforcing access at the database.

## Project layout

```
app/
  login/               email + password sign-in (client)
  auth/signout/        POST route that clears the session
  dashboard/           role-aware home; access-check + role panels
  a/[code]/            QR-code landing -> redirects to the matching asset
  (manager)/           Transport Manager / Admin only (layout enforces it)
    vehicles/          list · new · [id] detail (+QR, void) · [id]/edit
    plant/             same shape
    trailers/          same shape
components/
  app-header, app-nav, form-fields, qr-code, void-control
lib/
  supabase/            browser / server / proxy clients (@supabase/ssr)
  roles.ts             Role type, labels, isManager()
  assets.ts            status enums, form parsers (client-safe)
  assets-server.ts     assignable-people / vehicle lookups (server only)
proxy.ts               session refresh + redirect (no session -> /login)
supabase/              schema.sql (reference), seed.sql, seed_teardown.sql,
                       phase2_testdata_teardown.sql
```

## Testing Phase 2

Sign in as `manager@esker.test` or `admin@esker.test`. The nav bar gains
**Vehicles / Plant / Trailers**. Add a record, edit it, open its QR code,
scan-test by visiting `/a/<code>`, and try **Void** / **Restore**. Sign in as a
non-manager and confirm `/vehicles` bounces you to the dashboard.

Two throwaway assets (vehicle `T03`, plant `P02`) were created during testing and
left **voided**. Remove them with
[`supabase/phase2_testdata_teardown.sql`](supabase/phase2_testdata_teardown.sql),
or ignore them — they don't show in the active lists.

## Not yet built

Inspections, fault/mechanic workflow, compliance dashboard, reminders, offline
support, Vercel deploy, and self-signup (would need a `handle_new_user` trigger
in the database). See `docs/architecture-v1.md` §14.
