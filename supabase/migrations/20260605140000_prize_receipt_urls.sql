ALTER TABLE public.prize_registrations
  ADD COLUMN IF NOT EXISTS receipt1_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt2_url TEXT;
