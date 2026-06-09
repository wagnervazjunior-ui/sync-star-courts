-- Data/hora em que a categoria será disputada (para ordenação e exibição pública)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS event_date timestamptz;
