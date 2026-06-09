-- Premiações: flag na categoria
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS has_prize BOOLEAN NOT NULL DEFAULT false;

-- Tabela principal de premiações
CREATE TABLE public.prize_registrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  championship_id       UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  bracket_id            UUID REFERENCES public.brackets(id) ON DELETE SET NULL,
  placement             SMALLINT NOT NULL CHECK (placement IN (1, 2, 3)),
  team_name             TEXT NOT NULL,
  contact_email         TEXT,                    -- email para envio do link
  token                 TEXT UNIQUE NOT NULL,    -- link público de cadastro
  email_sent_at         TIMESTAMPTZ,
  -- Dados preenchidos pela dupla via link
  registered_at         TIMESTAMPTZ,
  recipient1_name       TEXT,
  recipient1_pix_key    TEXT,
  recipient1_pix_type   TEXT,
  recipient2_name       TEXT,                    -- nullable — só se split=true
  recipient2_pix_key    TEXT,
  recipient2_pix_type   TEXT,
  split_payment         BOOLEAN NOT NULL DEFAULT false,
  -- Pagamento (admin define valor e paga)
  amount_cents          INTEGER,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','registered','paid','cancelled')),
  paid_at               TIMESTAMPTZ,
  paid_by               UUID,
  transfer1_asaas_id    TEXT,                    -- pagamento ao recipient1
  transfer2_asaas_id    TEXT,                    -- pagamento ao recipient2 (split)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prize_reg_championship ON public.prize_registrations(championship_id);
CREATE INDEX idx_prize_reg_category     ON public.prize_registrations(category_id);
CREATE INDEX idx_prize_reg_token        ON public.prize_registrations(token);
