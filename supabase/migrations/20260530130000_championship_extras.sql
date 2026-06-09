-- Championship: PDF do regulamento, premiação geral, mapa incorporado
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS regulations_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS prize TEXT,
  ADD COLUMN IF NOT EXISTS location_embed_url TEXT;

-- Categoria: campo específico de regras
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS rules TEXT;
