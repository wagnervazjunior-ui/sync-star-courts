-- Add visibility toggle and scheduled opening date to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opens_at timestamptz;
