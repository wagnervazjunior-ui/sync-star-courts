ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS location_url text,
  ADD COLUMN IF NOT EXISTS policies text,
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS regulations text,
  ADD COLUMN IF NOT EXISTS shirt_size_guarantee_until timestamptz,
  ADD COLUMN IF NOT EXISTS shirt_size_chart_urls text[] NOT NULL DEFAULT '{}'::text[];