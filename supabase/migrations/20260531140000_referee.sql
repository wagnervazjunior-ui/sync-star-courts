-- Novo role para árbitros
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'referee';

-- Links de convite de árbitro por campeonato
CREATE TABLE public.referee_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referee_invites_token      ON public.referee_invites(token);
CREATE INDEX idx_referee_invites_champ      ON public.referee_invites(championship_id);

-- Vínculo árbitro ↔ campeonato
CREATE TABLE public.referee_championships (
  referee_user_id UUID NOT NULL,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  granted_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (referee_user_id, championship_id)
);

CREATE INDEX idx_referee_champ_user ON public.referee_championships(referee_user_id);
