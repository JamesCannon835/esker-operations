-- =====================================================================
-- PHASE 6 — schedule the reminder email (optional; only after the
-- send-reminders edge function is deployed and its secrets are set).
--
-- Easiest path: use the dashboard instead —
--   Edge Functions -> send-reminders -> Schedules -> "0 7 * * *"
--
-- If you prefer pg_cron, enable the extensions and run the block below,
-- replacing <PROJECT_REF> and <ANON_OR_SERVICE_KEY>.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'esker-compliance-reminders',
  '0 7 * * *',              -- 07:00 every day
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_OR_SERVICE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To remove it later:  select cron.unschedule('esker-compliance-reminders');
