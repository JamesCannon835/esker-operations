# Esker Operations — living roadmap

Supersedes the phase plan in `architecture-v1.md` §14. Updated as work lands.

_Last updated: 2026-09-03_

---

## Done

### V1 (original Phases 1–7)
Auth & per-role dashboards · vehicles / plant / trailers with QR codes · configurable
checklists · driver & operator daily walkaround · mechanic fault workflow (accept,
job timer, parts, labour, close) · scheduled inspections & services · compliance
dashboard (green/amber/red) · document storage · asset history & cost reporting.

### Built after V1
- **Training register** — people, courses, certificates, expiry tracking, register grid
- **Access codes** — create a person, hand them a 6-digit code, no email invite
- **Bulk import** — people and vehicles (with compliance dates) from pasted spreadsheet rows
- **Per-asset time & money view** + documents/photos section on every vehicle/plant/trailer
- **Admin settings** — yard labour rate
- Simplified driver walkaround · one-click "mark fixed" · vehicle categories (Mixers /
  Pump Truck / Block Trucks / Cars & Vans / Tippers) · named document uploads
- **Email notifications** (fault reported, inspection completed) — built, waiting on a
  verified sender address before it delivers reliably

---

## Now — Phase 8: Pilot
Load real data (people, trucks + compliance dates, plant, trailers, labour rate),
seed a few sample records, run it with a handful of real drivers + the mechanic,
show the team. Fix workflow problems while they're cheap.

## Phase 9 — Full rollout
Everyone on it, every asset loaded, drivers using it daily on their phones.

---

## Phases 10–14 — wider safety & quality system
Slot onto the same asset / document / people / audit structure.

- **10 · Training** — mostly built. Extend: inductions, driver CPC hours, toolbox-talk links.
- **11 · Toolbox Talks** — record a talk (topic, date, presenter), capture attendees
  (tick people from the register), attach the talk sheet, report on who's missed recent talks.
- **12 · Safety** — safety statement & RAMS library, site/task risk assessments,
  incident & near-miss reporting with photos and follow-up actions, corrective-action tracking.
- **13 · Quality** — concrete-specific: delivery dockets, batch records, cube-test
  results (7/28-day strengths, pass/fail vs spec), non-conformance reports, calibration
  records for the batching plant and test equipment.
- **14 · Verti-Block** — the block product line (production runs, QC, stock).

---

## Phases 15–17 — new areas (added 2026-09-03)

### 15 · Time off / leave
- Each person requests time off from their dashboard: type (annual / sick / unpaid /
  other), dates, half-days, reason.
- Transport manager / admin approves or declines; requester is notified.
- Leave calendar — who is off, and when — plus a clash warning when too many drivers
  are off the same day.
- Entitlement tracking per person: allowance, taken, booked, remaining (leave year
  configurable).
- Ties directly to the people already in the system; no separate HR list.

### 16 · Procurement / purchase orders
- Raise a purchase order → system issues an **order number**.
- A PO has a supplier, lines (description, qty, price), a job/asset it relates to,
  and a requester.
- Approval step: manager sign-off required above a spend threshold.
- Order numbers attach to **parts, services and fuel**, so spend rolls up into the
  existing per-asset "time & money" view.
- Supplier list; delivery/receipt marking; invoice scan attached to the PO
  (this absorbs the parked "scanned parts invoices" item).
- Report: committed spend, spend by supplier, spend by asset/job.

### 17 · Environmental management
For the EPA-licensed quarry / batching operation. Same compliance engine as vehicle
tax/CVRT, applied to the site.

- **Licence conditions** — the EPA/planning conditions as a checklist with due dates
  (green/amber/red), so nothing is missed.
- **Monitoring records** — water (settlement ponds, discharge points), dust, noise,
  vibration/blast records; scheduled, logged, with results vs limits.
- **Environmental incidents & complaints** — spills, dust/noise complaints, water
  exceedances; photos, root cause, corrective actions, close-out.
- **Waste** — waste streams (waste oil, filters, tyres, general), transfer dockets,
  registered hauliers/facilities, quantities.
- **Environmental documents** — licence, monitoring reports, audits, correspondence
  with the EPA.
- Environmental compliance calendar + reminders, alongside the fleet one.

---

## Parked / cross-cutting
- **Email notifications** — needs `updates.eskerreadymix.ie` verified in Resend
  (one DNS record) or a Gmail sender; then flip `NOTIFY_FROM` and redeploy.
- **Inspection checklist rework** — pending a sit-down with the mechanic.
- **Plant & trailer bulk import** — same pattern as vehicles, not yet built.
- **Offline mode** — poor signal on sites; the single biggest technical job. Treat as
  its own project with real on-site testing.
- **Native app** (Capacitor wrapper of the same code) — for app-store install and
  better camera/push on iOS. After the web app is solid in daily use.
