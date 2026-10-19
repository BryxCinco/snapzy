-- =============================================================================
-- Snapzy — Phase 8: smart extraction
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- `metadata` holds structured data the AI found in the image, e.g.
--   { "wifi":    { "ssid": "...", "password": "...", "security": "WPA2" },
--     "flight":  { "flight_number": "PR 102", "date": "...", "gate": "...", "seat": "..." },
--     "payment": { "provider": "GCash", "amount": "1,250.00", "currency": "PHP",
--                  "reference_number": "..." } }
-- NULL when nothing was found.
-- =============================================================================

alter table public.screenshots
  add column if not exists metadata jsonb;

-- Lets you query e.g. "all photos with WiFi details" later.
create index if not exists screenshots_metadata_idx
  on public.screenshots using gin (metadata jsonb_path_ops);
