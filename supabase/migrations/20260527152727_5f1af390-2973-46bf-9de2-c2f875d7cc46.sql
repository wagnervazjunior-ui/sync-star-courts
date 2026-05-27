
-- 1. staff_invites: per-championship
ALTER TABLE public.staff_invites
  ADD COLUMN IF NOT EXISTS championship_id uuid;

UPDATE public.staff_invites SET active = false WHERE championship_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_invites_owner_champ ON public.staff_invites (owner_admin_id, championship_id) WHERE active;

-- 2. staff_championships (vínculo staff x campeonato)
CREATE TABLE IF NOT EXISTS public.staff_championships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  championship_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, championship_id)
);

GRANT ALL ON public.staff_championships TO service_role;
ALTER TABLE public.staff_championships ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_champ_no_direct ON public.staff_championships
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_staff_champ_staff ON public.staff_championships (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_champ_champ ON public.staff_championships (championship_id);

-- 3. staff_fees (cachê combinado)
DO $$ BEGIN
  CREATE TYPE public.fee_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_creator_role AS ENUM ('staff', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.staff_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  championship_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  description text NOT NULL DEFAULT '',
  receipt_path text,
  status public.fee_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  paid_by uuid,
  created_by_role public.fee_creator_role NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, championship_id)
);

GRANT ALL ON public.staff_fees TO service_role;
ALTER TABLE public.staff_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_fees_no_direct ON public.staff_fees
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER staff_fees_updated_at
  BEFORE UPDATE ON public.staff_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_staff_fees_staff ON public.staff_fees (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_fees_champ ON public.staff_fees (championship_id);
