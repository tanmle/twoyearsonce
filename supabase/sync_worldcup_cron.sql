-- Optional: schedule automatic World Cup result sync every 5 minutes.
-- Prereqs in Supabase SQL editor:
--   create extension if not exists pg_cron with schema extensions;
--   create extension if not exists pg_net with schema extensions;
-- Replace <PROJECT_REF> and <SUPABASE_ANON_KEY>, then run.

select cron.schedule(
  'beercup-sync-worldcup-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://mshqitvirvydhvzdhjwh.functions.supabase.co/sync-worldcup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaHFpdHZpcnZ5ZGh2emRoandoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTczNzMsImV4cCI6MjA5NjgzMzM3M30.TMIqlvyBWrI4-3Qk2nnePKW9q6OCUG99SK53BMu7dxY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To disable later:
-- select cron.unschedule('beercup-sync-worldcup-every-5-min');
