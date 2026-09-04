# Architecture review — can the system carry the whole business?

_2026-09-04. Written after a full pass over the schema (`supabase/schema.sql` + every
migration) and the app. Development paused to answer one question: will the database
support People/HR, Training, H&S, Quality, Environmental, Quarry, Plant, Procurement,
Documents, Compliance and Action Management **without a rebuild** — and without
breaking anything in Transport._

---

## Short answer

**Yes.** Two things were asked and they have different answers:

| Concern | Verdict |
|---|---|
| **Can it hold the volume of information?** | Not a worry. Postgres at Esker's scale (dozens of assets, ~50 people, thousands of records a year per area) is operating at a fraction of 1% of its capacity. Room for 100× growth before anything needs tuning. |
| **Is it structured so new modules bolt on cleanly?** | Mostly yes — the core patterns are right. There are **6 foundation changes** worth making once, now, while there is almost no data. After that, every future module is additive. |

None of the 6 changes are destructive. Each is `CREATE TABLE` or `ALTER` — existing
Transport tables, data and functionality are untouched. They should land as **one
"Foundation v2" migration** before the second module (Training is already partly built;
treat it as the pilot for the new pattern).

---

## What's already right (keep)

1. **Postgres / Supabase.** A real relational database with Row Level Security,
   triggers, views, JSON columns. This is the correct engine for a compliance-grade
   business system. It is not a spreadsheet that falls over.
2. **Generic linking by `(type, id)`.** `documents`, `compliance_items`,
   `inspections`, `faults` and `services` attach to a thing via an
   `asset_type` + `asset_id` pair, not a hard foreign key. This is *the* reason new
   modules can reuse them. The original architecture doc called this out deliberately.
3. **Multi-role users.** Roles live in a `user_roles` table, not a single column, so a
   person can be e.g. Transport Manager + H&S Officer. New roles are one enum value each.
4. **RLS everywhere.** Access rules are enforced in the database, not just hidden in
   the UI — necessary once HR, H&S and payroll-adjacent data is in there.
5. **Audit log shape.** `(table_name, record_id, action, old_value, new_value)` is the
   right generic shape for a regulator-facing audit trail.
6. **Lookup tables for user-managed lists.** `training_courses` is already a table the
   user can edit. That is the pattern to repeat.

---

## The 6 foundation changes

### 1. `asset_type` → `entity_type` (broaden the generic link)

**Now:** `asset_type_t` is a fixed enum `('vehicle','plant','trailer')`. Everything
generic (`compliance_items`, `inspections`, `faults`, `services`, `documents`) is locked
to those three.

**Problem:** Training certs attach to a **person**. EPA monitoring attaches to a
**discharge point** or the **site**. A purchase order attaches to a **supplier** or a
**job**. Quality records attach to the **batching plant** or a **mix design**. None of
those are a vehicle/plant/trailer.

**Change:** widen the column so it can name any kind of record —
`vehicle`, `plant`, `trailer`, `person`, `site`, `quarry_area`, `plant_item`
(batching), `supplier`, `mix_design`, `purchase_order`, … Either add enum values
(safe, `ALTER TYPE ADD VALUE`) or move to `text` with a lookup table of valid types.
Recommended: `text` + a small `entity_types` table.

**Impact:** rename in code from "asset" to "entity" for the shared tables; existing
rows keep working (`'vehicle'` is still `'vehicle'`). ~1 day, no data migration.

---

### 2. `compliance_items` becomes a universal date engine

**Now:** `compliance_type_t` enum is fleet-only (`tax`, `cvrt_test`,
`tacho_calibration`, …).

**Change:** replace the enum with a **`compliance_types`** lookup table:

```
compliance_types(
  code, label, applies_to (entity type), default_warning_days,
  recurring_months, authority, active
)
```

and change `compliance_items.compliance_type` to `text` referencing it.

**Then** the same green/amber/red engine already on the dashboard covers: vehicle tax,
EPA licence conditions, insurance renewals, Safe Pass expiry, fire-cert, LEV testing,
weighbridge calibration, blasting licence, extraction-limit reviews — anything with a
"next due" date. Reminders, the grid, the traffic lights: all reused.

**Impact:** ~1 day. Existing compliance rows map 1:1 to seeded lookup codes.

---

### 3. New primitive — **`actions`** (corrective actions / follow-ups)

**Now:** there is no generic "someone must do X by Y" record. It's implicit (a fault
gets closed; a training record exists).

**Problem:** H&S incidents, quality non-conformances, audit findings, environmental
exceedances, near-misses, and toolbox-talk actions all produce **follow-up actions
with an owner and a due date that must be tracked to closure**. That's the same shape
every time.

**Change:** one new table, used by every module:

```
actions(
  id, entity_type, entity_id,        -- what it came from
  source (incident/ncr/audit/inspection/manual/…),
  title, detail,
  assigned_to (person), raised_by,
  priority, due_date,
  status (open/in_progress/done/cancelled),
  completed_at, completed_by, verification_note
)
```

**Impact:** purely additive. Gives you an "Action Management" module for free the day
it's created, and every later module feeds it.

---

### 4. Split **person** from **login**

**Now:** `public.users` *is* the person, and every `users` row must have a Supabase
Auth login (`users.id` → `auth.users.id`).

**Problem:** HR, Training and H&S track **people who may never log in** —
subcontract drivers, agency operators, site visitors doing an induction, a new hire
before their start date. Today you can't hold a training record or an induction for
someone without creating them a login.

**Change:** introduce **`people`** as the master record:

```
people(
  id, first_name, last_name, known_as,
  employee_number, job_title, department/org_unit,
  employment_type, start_date, end_date,
  dob, address, emergency_contact,
  licence_number, cpc_expiry, …,
  is_active
)
```

`users` keeps the login and gains `users.person_id` (optional). Training, HR, H&S,
leave, actions all point at **`people`**, not `users`. A person with app access has
both rows linked; a subbie has only a `people` row.

**Why now:** this is the one change that gets materially harder later. Training is
already built against `users` — porting it while it holds a handful of test records is
easy; porting it after 200 real training entries is not. **Do this first.**

**Impact:** ~2 days including re-pointing the Training module. Sensitive fields (DOB,
address, PPS) get their own stricter RLS and are never exposed to non-HR roles.

---

### 5. Light **org structure** — `org_units` / `sites`

**Now:** nothing. Everything is one flat company.

**Problem:** Procurement needs cost centres/budgets. HR needs departments.
Environmental and H&S are **site-based** (the quarry, the yard, the block plant, a
contract site). Quarry module is inherently about areas within a site.

**Change:**

```
sites(id, name, type (quarry/yard/plant/office/contract), eircode, active)
org_units(id, name, parent_id, cost_centre, manager_id)
```

Add optional `site_id` / `org_unit_id` to the records that need scoping. Keep it
optional so Transport is unaffected.

**Impact:** ~half a day for the tables; each module wires in the FK it needs.

---

### 6. Convention — lookup tables, not enums, for anything users manage

Postgres enums can gain values but can't be reordered, can't be removed, and can't
carry metadata (a label, a colour, a "still active?" flag). Fine for fixed internal
states (`fault_status_t` stays). **Not** fine for lists the business will grow:
incident categories, document types, action priorities, waste streams, PPE types,
supplier categories, quarry material types.

Every such list = a small table with `code, label, sort_order, active`. `training_courses`
already does this. Make it the house rule.

---

## How the modules then land (all additive)

| Module | New tables | Reuses |
|---|---|---|
| **People / HR** | `people` (see #4), `employment_history`, `leave_requests`, `leave_balances` | `documents`, `compliance_items` (cert expiries), `actions` |
| **Training** | already built — re-point to `people`; add `training_matrix` (role → required courses) | `compliance_items` (expiry), `documents` (certs), reminders |
| **H&S** | `incidents`, `risk_assessments`, `method_statements`, `toolbox_talks`, `toolbox_talk_attendees` | `actions`, `documents`, `people`, `sites` |
| **Quality** | `deliveries` (dockets), `batches`, `cube_tests`, `nc_reports`, `mix_designs` | `actions`, `documents`, `compliance_items` (calibration), `sites` |
| **Environmental** | `env_monitoring` (water/dust/noise/blast), `env_incidents`, `waste_movements`, `licence_conditions` | `compliance_items` (the engine), `actions`, `documents`, `sites` |
| **Quarry** | `quarry_areas`, `extraction_records`, `blast_records`, `stock_levels` | `documents`, `compliance_items`, `sites` |
| **Plant** | already built (`plant`) — extend with hire tracking, meter readings | `compliance_items`, `services`, `inspections`, `documents` |
| **Procurement** | `suppliers`, `purchase_orders`, `po_lines`, `goods_received`, `invoices` | `documents` (invoice scans), `org_units` (cost centres), links to `parts_used`/`services` |
| **Documents** | `document_versions`, `document_reviews` | extend `documents` with `owner_id`, `review_date`, `status`, `supersedes_id` |
| **Compliance** | `compliance_types` (see #2) | the existing grid, reminders, traffic lights |
| **Action Management** | `actions` (see #3) | everything |

Every row above is `CREATE TABLE` or `ADD COLUMN`. Nothing drops. Transport keeps working.

---

## Also worth doing (not blockers)

- **Automatic audit-log triggers** on the tables regulators care about (H&S, environmental,
  quality, compliance) instead of the current manual writes.
- **`updated_at` triggers** — several tables have the column but rely on the app to set it.
- **Soft-delete consistency** — `voided` exists on most tables but not all; standardise.
- **Storage:** stays fine. One private bucket, signed URLs. Add folder prefixes per
  module (`hr/`, `env/`, `quality/`) for tidiness.
- **`breakdowns` table** is dead (feature removed) — drop it in the Foundation v2 migration.

---

## Recommendation

1. **Approve the 6 changes.** They are the difference between "modules bolt on" and
   "we rebuild in 18 months."
2. Build them as **one migration, `foundation_v2.sql`**, tested on a copy first.
3. Sequence: **#4 (people/login split) and #1 (entity_type) first** — they're the ones
   that get harder with data. Then #2, #3, #5, #6.
4. Re-point the **Training** module onto `people` as the proof it works.
5. Resume module development (roadmap Phases 15–17 etc.) on the new foundation.

Estimated effort for Foundation v2: **~1 week**, no downtime, no data loss, Transport
untouched throughout.
