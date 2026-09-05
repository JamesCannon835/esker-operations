-- =====================================================================
-- New role: yard_staff (yard & quarry operatives).
--
-- ⚠ RUN THIS FILE ON ITS OWN, FIRST. Postgres won't let a new enum value
-- be used in the same transaction it's added in, so the access rules that
-- reference 'yard_staff' are in a separate file: yard_staff_access.sql.
-- =====================================================================

alter type app_role add value if not exists 'yard_staff';
