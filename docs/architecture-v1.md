# Esker Operations — Architecture Review (Version 1)

This document covers everything you asked for: architecture, database design, roles, screens, tech stack, costs, risks, and a step-by-step plan. Nothing has been built yet — this is the blueprint to review and correct before any code is written.

---

## 1. Recommended technical architecture

Your instinct on the stack is right, with one addition:

| Layer | Recommendation | Why |
|---|---|---|
| Frontend framework | **Next.js** (React), built as a PWA | This is the piece your original list didn't name. "Responsive web app" needs an actual framework — Next.js is the standard pairing with Supabase, works well with Claude Code, and gives you the PWA install-to-homescreen behaviour on phones without needing a native app yet. |
| Database + Auth + Storage | **Supabase** | Postgres database, built-in authentication, Row Level Security (RLS) for permissions, and file storage for photos/documents — all in one. Good fit for a non-coder because most rules live in the database, not scattered across app code. |
| Source control | **GitHub** | Correct as proposed. |
| Hosting | **Vercel** | Correct as proposed — pairs natively with Next.js, deploys automatically from GitHub. |
| Later: native app | **Capacitor** wrapping the same Next.js/PWA codebase | Lets you ship to the App Store and Google Play later *without* rewriting the app. This is why the PWA-first approach matters — it's not a detour, it's the same codebase becoming installable. |
| Reminders/notifications | **Supabase scheduled functions (cron)** + **Resend** (email) | Handles the "automatic reminders" requirement. SMS (via Twilio) can be added later if email isn't urgent enough for compliance alerts. |
| Offline support | **Service worker + local queue (IndexedDB)**, syncing to Supabase when back online | Realistic for V1 only if scoped carefully — see Risks (§12) and Missing Info (§13) below. |

This is a standard, well-trodden combination — nothing exotic, which matters given you're not coding it yourself and will rely on Claude Code to generate most of it.

---

## 2–5. Database schema, tables, fields, and relationships

Designed so **Training, Safety, and Quality (Phases 10–14) slot in later without restructuring anything below.** The pattern that makes this possible: assets, documents, faults, and inspections are all linked generically (by `asset_type` + `asset_id`) rather than hard-coded to "vehicle" — so a future `training_records` table just plugs into the same `documents` and `audit_log` tables.

### Core identity

**`users`** (extends Supabase's built-in `auth.users`)
- `id` (matches auth.users id)
- `full_name`
- `role` — enum: `driver`, `plant_operator`, `mechanic`, `transport_manager`, `admin`
- `phone`
- `active` (boolean — for leavers, don't delete)
- `created_at`

For V1, one `role` field per user is enough — you don't need a separate permissions table yet. If someone is both a driver *and* a mechanic, we can revisit this as a multi-role list later; flag if that's already true for anyone.

### Assets

**`vehicles`**
- `id`, `fleet_number`, `registration`, `make`, `model`, `vehicle_type`, `year`, `vin`
- `current_mileage`, `fuel_type`
- `status` (enum: `available`, `in_use`, `maintenance`, `breakdown`, `off_road`, `retired`)
- `assigned_driver_id` (→ users)
- `service_interval_km`, `next_service_mileage`, `next_service_date`
- `qr_code` (unique string, generated on creation)
- `notes`
- `created_at`, `updated_at`

**`plant`**
- `id`, `asset_number`, `plant_type`, `make`, `model`, `year`, `serial_number`
- `current_hours`, `service_interval_hours`, `next_service_hours`, `next_service_date`
- `status`, `assigned_operator_id` (→ users), `qr_code`, `notes`

**`trailers`**
- `id`, `registration`, `trailer_type`, `make`, `model`, `year`, `vin`
- `assigned_vehicle_id` (→ vehicles, nullable), `qr_code`, `notes`

**`compliance_items`** — one row per compliance date, per asset. This is the flexible design that avoids bolting a new column onto `vehicles` every time a new compliance type appears.
- `id`, `asset_type` (`vehicle`/`plant`/`trailer`), `asset_id`
- `compliance_type` (enum: `tax`, `cvrt_test`, `insurance`, `thirteen_week_inspection`, `tackle_inspection`, `tacho_calibration`, `service`, other — extensible)
- `due_date`, `last_completed_date`, `status` (`green`/`amber`/`red`, calculated)
- `notes`

*This directly answers your "13-week inspection due date / Tackle inspection due date / Tachograph date" fields — instead of separate columns per asset table, they're all rows here, which is also what makes the amber/red dashboard logic simple: one query across this whole table.*

### Inspections

**`inspection_templates`** — configurable checklists (so you can edit "what's on the daily checklist" without a code change)
- `id`, `name` (e.g. "Vehicle Daily Check", "Excavator Daily Check", "13-Week Inspection")
- `asset_type`, `category` (e.g. "Exterior", "Engine/Mechanical", "Cab", "Safety Equipment")

**`inspection_template_items`**
- `id`, `template_id`, `item_name`, `sort_order`

**`inspections`** — one row per completed inspection (daily, 13-week, or pre-test, distinguished by `inspection_type`)
- `id`, `inspection_type` (`daily_vehicle`, `daily_plant`, `thirteen_week`, `pre_test`)
- `asset_type`, `asset_id`, `template_id`
- `completed_by` (→ users), `mileage_or_hours`
- `result` (`pass`/`fail` — fail if any item failed)
- `signature_confirmed` (boolean), `completed_at`

**`inspection_item_results`**
- `id`, `inspection_id`, `template_item_id`
- `result` (`pass`/`fail`/`na`), `comment`, `photo_url`

A failed item can trigger a `faults` row automatically — see below.

### Faults, work, parts

**`faults`**
- `id`, `asset_type`, `asset_id`
- `reported_by` (→ users), `reported_at`, `location`
- `category`, `description`, `severity` (`critical`/`urgent`/`normal`/`monitor`)
- `safe_to_operate` (boolean)
- `photo_url`, `video_url`
- `status` (`reported`, `accepted`, `in_progress`, `awaiting_parts`, `completed`, `closed`)
- `assigned_mechanic_id` (→ users, nullable)
- `diagnosis`, `source_inspection_id` (nullable — links back if auto-created from a failed inspection item)
- `closed_by`, `closed_at`

**`labour_entries`**
- `id`, `fault_id` (→ faults), `mechanic_id`
- `start_time`, `stop_time`, `entry_type` (`diagnosis`/`repair`/`waiting`)
- `corrected_by`, `correction_reason` (for the "authorised users can correct a time entry" requirement — keeps a trail rather than silently overwriting)

**`parts_used`**
- `id`, `fault_id`, `part_name`, `part_number`, `quantity`, `unit_cost`, `supplier`, `total_cost` (calculated)

**`services`**
- `id`, `asset_type`, `asset_id`, `service_date`, `mileage_or_hours`, `performed_by`, `notes`, `cost`

**`breakdowns`**
- `id`, `vehicle_id`, `driver_id`, `reported_at`
- `location_lat`, `location_lng` (nullable — only if permission granted)
- `problem_description`, `immobilised` (boolean), `photo_url`, `video_url`
- `mechanic_notified_at`, `mechanic_arrived_at`, `recovery_required` (boolean)
- `repair_completed_at`, `returned_to_service_at`
- *(downtime is calculated: `returned_to_service_at` − `reported_at`)*

### Documents & audit

**`documents`**
- `id`, `asset_type`, `asset_id`, `category` (`registration`/`insurance`/`test_cert`/`service_record`/`manual`/`invoice`/other)
- `file_url`, `uploaded_by`, `uploaded_at`, `expiry_date` (nullable)

**`audit_log`**
- `id`, `table_name`, `record_id`, `action` (`create`/`update`/`delete`/`void`)
- `changed_by`, `changed_at`, `old_value` (jsonb), `new_value` (jsonb)

This table is what satisfies "don't allow compliance records to simply disappear" — combined with a `voided` boolean on sensitive tables instead of real deletion, so nothing with legal/safety weight can vanish.

### How it all connects

```
users ──< assigned to >── vehicles / plant
vehicles / plant / trailers ──< compliance_items (many dates per asset)
vehicles / plant ──< inspections ──< inspection_item_results
inspections ──> faults (auto-created from a failed item)
faults ──< labour_entries, parts_used
vehicles / plant / trailers ──< documents
every table's changes ──> audit_log
```

---

## 6. User roles and exact permissions

| Action | Driver | Plant Operator | Mechanic | Transport Manager | Admin |
|---|---|---|---|---|---|
| View own assigned vehicle/plant | ✅ | ✅ | — | ✅ (all) | ✅ (all) |
| Complete daily inspection | ✅ (vehicle) | ✅ (plant) | — | view only | view only |
| Report fault/breakdown | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own inspection history | ✅ | ✅ | — | ✅ (all) | ✅ (all) |
| Edit vehicle/plant/trailer master data | ❌ | ❌ | ❌ | ✅ | ✅ |
| Accept/assign fault jobs | ❌ | ❌ | ✅ | ✅ | ✅ |
| Record diagnosis, repairs, parts, labour | ❌ | ❌ | ✅ | view only | view only |
| Start/stop job timer | ❌ | ❌ | ✅ | — | — |
| Complete 13-week / pre-test inspections | ❌ | ❌ | ✅ | view only | view only |
| Close a fault/job | ❌ | ❌ | ✅ | ✅ (override) | ✅ |
| Change compliance dates | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete/void a record | ❌ | ❌ | ❌ | ❌ (void only, not delete) | ✅ (void only) |
| View costs (parts cost, labour cost) | ❌ | ❌ | Own labour entries only | ✅ | ✅ |
| View management dashboard | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage users/roles | ❌ | ❌ | ❌ | ❌ | ✅ |

This maps directly onto Supabase Row Level Security — the "driver must not bypass frontend permissions" requirement is enforced *at the database*, not just hidden in the interface, so even a technically curious driver poking at the API directly can't reach management data.

One judgement call flagged for you: I've kept **costs (parts/labour cost) hidden from mechanics by default**, showing them only their own time entries, not prices — common practice so the workshop floor isn't a general financial dashboard. Tell me if that's wrong for how you run things.

---

## 7–8. Screen structure and navigation by role

**Driver** (phone, large-button, minimal typing)
```
Login → My Vehicle
  → Daily Check (or scan QR) → Checklist → Mileage → Faults? → Sign → Submit
  → Report Fault (any time)
  → BREAKDOWN (big red button, always accessible)
  → My Inspection History
```

**Plant Operator** — identical shape, "My Vehicle" → "My Plant", mileage → hours.

**Mechanic** (tablet or workshop PC)
```
Login → Dashboard (my jobs, unassigned faults)
  → Vehicles / Plant / Trailers (browse or scan QR)
  → Fault detail → Accept → Diagnose → Start Job Timer → Parts → Stop Job Timer → Close
  → 13-Week Inspection (select asset → checklist → defects → sign)
  → Pre-Test Inspection (same shape)
  → Service Log
```

**Transport Manager**
```
Login → Dashboard (fleet status, faults, compliance, breakdowns)
  → Vehicles / Plant / Trailers (add/edit, assign drivers)
  → Compliance (green/amber/red across everything)
  → Faults (all, filterable)
  → Reports
  → Documents
```

**Admin/Management** — everything Transport Manager has, plus:
```
  → Users & Roles
  → Audit Log
  → System Settings (checklist templates, reminder periods)
```

---

## 9. Technology stack summary

- Next.js (React) — frontend, PWA
- Supabase — Postgres, Auth, Storage, RLS, scheduled functions
- GitHub — source control
- Vercel — hosting/deployment
- Resend — email reminders
- Capacitor — native app wrapper (Phase 9+, not V1)

---

## 10. Estimated monthly running costs

| Item | Cost | Notes |
|---|---|---|
| Supabase | Free while small; **~€25/mo (Pro)** once you exceed free-tier storage/database limits — likely within the first few months given photos | Photos are the main driver of storage growth |
| Vercel | Free for this use case initially; **~€20/mo (Pro)** if you need more bandwidth or team seats later | |
| Domain name | **~€12–15/year** | |
| Resend (email reminders) | Free tier covers V1 volume; **~€20/mo** if you scale past it | |
| Apple Developer account | **~€99/year** | Only needed when you move to the App Store (Phase 9+), not for V1 |
| Google Play account | **~€25 one-time** | Same — later phase |
| **V1 estimate** | **roughly €0–45/month** to start, likely **€40–65/month** within 6 months as data grows | |

Nothing here is expensive relative to running paper-based compliance — this is worth saying plainly since cost was likely a factor in comparing against buying an off-the-shelf fleet system.

---

## 11. Accounts you'll need to create

- GitHub (free)
- Supabase (free to start)
- Vercel (free to start)
- Resend (free to start)
- A domain registrar (if you want a proper esker-operations.ie style address rather than the free Vercel subdomain)
- Apple Developer + Google Play — later, not now

I can walk you through each sign-up when we get there — none require technical knowledge, just account creation and (for Apple) a wait for developer approval, which can take a few days, worth starting early once you're close to Phase 9.

---

## 12. Technical risks

- **Offline sync is the single biggest technical risk in this whole project.** Genuinely reliable offline-first behaviour (queue locally, sync later, never lose or duplicate an inspection) is a substantial piece of engineering on its own — not something to bolt on casually. Recommend treating it as its own mini-phase with real testing at a site with poor signal, rather than assuming it "just works."
- **iOS PWA limitations** — Safari restricts push notifications and camera/QR behaviour for web apps more than Android does. This is the practical reason Capacitor is on the roadmap rather than staying PWA-only forever, if push alerts to drivers turn out to matter.
- **RLS misconfiguration** — the entire security model rests on Row Level Security rules being right. One misconfigured policy could expose management data. This needs deliberate testing (logging in as each role and confirming what they *can't* see) before go-live, not just testing what they can do.
- **Storage cost growth from photos** — daily inspection photos across a full fleet add up fast. Worth deciding a photo compression/retention policy early rather than after storage bills spike.
- **Job timer edge cases** — a mechanic who forgets to press "stop," or starts a job and gets pulled onto something else, will produce messy labour data unless the interface makes idle timers obvious and easy to correct (with an audit trail, as designed above).
- **GDPR/data protection** — you're storing driver names, photos, and vehicle usage data. Nothing unusual for a fleet system, but worth a short data protection review once real drivers' data is in it, not as an afterthought.
- **Single point of knowledge** — since you're not writing the code yourself, make sure there's a plan for how the system gets maintained/extended if your working relationship with whoever builds it (Claude Code sessions, a developer, etc.) changes. GitHub + clear documentation is the safety net here.

---

## 13. Information I need from you before Phase 1 starts

These affect real design decisions, not just polish:

1. **Scale** — roughly how many vehicles, plant items, trailers, and users (drivers/operators/mechanics) at launch? This affects whether the free tiers of Supabase/Vercel last you months or weeks.
2. **Sites** — one yard, or multiple depots/sites? If multiple, do vehicles/plant move between them, and should compliance or dashboards be filterable by site?
3. **Offline requirement** — how bad is signal at your quarries/sites in practice? If it's genuinely unusable for stretches, offline needs to be in an early phase, not deferred. If it's occasional, we can defer it and reduce Phase 1 risk considerably.
4. **Devices** — are drivers using company-issued phones, or their own (BYOD)? Affects whether we can assume camera/QR access and app permissions, or need to design around inconsistent devices.
5. **"Tackle inspection"** — your spec lists this as its own compliance/checklist item separate from the 13-week inspection. Can you confirm what this refers to (lifting tackle/chains? something else?) so the checklist and compliance category are named correctly?
6. **Native app urgency** — is a browser-based PWA acceptable to launch with, or is App Store presence needed from day one? This changes how soon Capacitor work needs to start.
7. **Shared vs personal logins** — will each driver log into their own phone with their own account, or will some trucks/workshop tablets be shared devices with a shared login? Affects session design and how "my vehicle" is determined.
8. **Multi-role people** — is anyone both a driver and a mechanic, or a transport manager who also drives? If so, the single-role-per-user design above needs a small change.
9. **Data retention** — is there a legal minimum period you need to keep inspection/compliance records for (common in transport compliance)? Affects whether "void" is enough or whether records need a formal minimum-retention rule.

Answer whatever you can — anything you leave open, I'll flag as an assumption and we adjust later rather than blocking on it.

---

## 14. Step-by-step development plan (zero coding experience)

**Phase 1 — Foundations** (you: create accounts, review structure / me: build database, auth, roles)
1. You create GitHub, Supabase, and Vercel accounts (I'll walk you through each).
2. I build the database tables above in Supabase.
3. I set up login/authentication and the 5 user roles with their permission rules.
4. You test logging in as each role on a basic placeholder screen, to confirm each role can only see what it should — before anything else is built on top.

**Phase 2 — Assets**
5. Vehicle, plant, and trailer records — add/edit screens for Transport Manager/Admin.
6. QR code generation per asset.
7. You start entering your real fleet data here — this is the first point where the system holds real information.

**Phase 3 — Daily inspections**
8. Configurable checklist builder (so you can edit checklist items without needing me).
9. Driver daily vehicle inspection flow.
10. Plant operator daily inspection flow.
11. Fault reporting from a failed checklist item or standalone report.

**Phase 4 — Mechanic workflow**
12. Mechanic dashboard, fault acceptance, job timer, parts, labour recording, job closing.

**Phase 5 — 13-week & pre-test inspections, services**
13. Dedicated inspection forms, service logging and due-date calculation.

**Phase 6 — Compliance, documents, reminders**
14. Central compliance dashboard (green/amber/red), document uploads, automatic email reminders.

**Phase 7 — Breakdowns, history, reporting**
15. Breakdown workflow, asset timeline view, cost reporting.

**Phase 8 — Real-world pilot**
16. Test with a small number of real vehicles and real users (not everyone at once) before full rollout — this is where most of the "did we get the workflow right" problems surface, cheaply.

**Phase 9 — Full rollout**, then **Phases 10–14** (Training, Toolbox Talks, Safety, Quality, Verti-Block) as originally planned, once V1 is solid and in daily use.

At each phase boundary, I'll show you what's built, you use it for real before we move to the next phase — not build all 9 phases blind and hope it's right at the end.
