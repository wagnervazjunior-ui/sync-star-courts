
-- Enums
CREATE TYPE public.pix_key_type AS ENUM ('cpf', 'email', 'phone', 'random');
CREATE TYPE public.reimbursement_category AS ENUM ('alimentacao', 'transporte', 'passagem', 'gasolina', 'hospedagem', 'outro');
CREATE TYPE public.reimbursement_status AS ENUM ('pending', 'paid');

-- Invites
CREATE TABLE public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_invites_owner ON public.staff_invites(owner_admin_id);
GRANT ALL ON public.staff_invites TO service_role;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_invites_no_direct" ON public.staff_invites FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Staffs
CREATE TABLE public.staffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL,
  name text NOT NULL,
  cpf text NOT NULL,
  rg text NOT NULL,
  birthdate date NOT NULL,
  contact_email text,
  contact_phone text,
  pix_key_type public.pix_key_type NOT NULL,
  pix_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_admin_id, cpf)
);
CREATE INDEX idx_staffs_owner ON public.staffs(owner_admin_id);
CREATE TRIGGER staffs_set_updated_at BEFORE UPDATE ON public.staffs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT ALL ON public.staffs TO service_role;
ALTER TABLE public.staffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staffs_no_direct" ON public.staffs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Sessions
CREATE TABLE public.staff_sessions (
  token text PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.staffs(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_sessions_staff ON public.staff_sessions(staff_id);
GRANT ALL ON public.staff_sessions TO service_role;
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_sessions_no_direct" ON public.staff_sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Reimbursements
CREATE TABLE public.staff_reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staffs(id) ON DELETE CASCADE,
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  category public.reimbursement_category NOT NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  expense_date date NOT NULL,
  receipt_path text,
  status public.reimbursement_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reimb_staff ON public.staff_reimbursements(staff_id);
CREATE INDEX idx_reimb_championship ON public.staff_reimbursements(championship_id);
CREATE INDEX idx_reimb_status ON public.staff_reimbursements(status);
CREATE TRIGGER reimb_set_updated_at BEFORE UPDATE ON public.staff_reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT ALL ON public.staff_reimbursements TO service_role;
ALTER TABLE public.staff_reimbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_reimb_no_direct" ON public.staff_reimbursements FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Storage bucket for receipts (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-receipts', 'staff-receipts', false)
ON CONFLICT (id) DO NOTHING;
