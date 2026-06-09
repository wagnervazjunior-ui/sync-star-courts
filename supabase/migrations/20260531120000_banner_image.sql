-- Campo separado para banner do cabeçalho na página do campeonato
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT;
