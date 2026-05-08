
-- Enums
CREATE TYPE public.shirt_size AS ENUM ('P','M','G','GG','XG');
CREATE TYPE public.registration_status AS ENUM ('pending','confirmed','cancelled');
CREATE TYPE public.app_role AS ENUM ('admin');

-- Championships
CREATE TABLE public.championships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  start_date date,
  end_date date,
  location text,
  cover_image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  max_slots int NOT NULL CHECK (max_slots > 0),
  price_cents int NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_championship ON public.categories(championship_id);

-- Registrations
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_code text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  contact_email text NOT NULL,
  athlete1_name text NOT NULL,
  athlete1_phone text NOT NULL,
  athlete1_shirt_size public.shirt_size NOT NULL,
  athlete2_name text NOT NULL,
  athlete2_phone text NOT NULL,
  athlete2_shirt_size public.shirt_size NOT NULL,
  status public.registration_status NOT NULL DEFAULT 'pending',
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, contact_email)
);
CREATE INDEX idx_registrations_category ON public.registrations(category_id);
CREATE INDEX idx_registrations_status ON public.registrations(status);

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_championships_updated BEFORE UPDATE ON public.championships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_registrations_updated BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Championships policies
CREATE POLICY "championships_select_public" ON public.championships
  FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "championships_admin_all" ON public.championships
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Categories policies
CREATE POLICY "categories_select_public" ON public.categories
  FOR SELECT USING (true);
CREATE POLICY "categories_admin_all" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Registrations: admin total; público só via RPCs
CREATE POLICY "registrations_admin_select" ON public.registrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "registrations_admin_update" ON public.registrations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "user_roles_select_self" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Voucher generator
CREATE OR REPLACE FUNCTION public.generate_voucher_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'OS-';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- create_registration RPC (with row lock)
CREATE OR REPLACE FUNCTION public.create_registration(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id uuid := (payload->>'category_id')::uuid;
  v_max int;
  v_count int;
  v_voucher text;
  v_id uuid;
  v_attempts int := 0;
BEGIN
  -- Lock category row
  SELECT max_slots INTO v_max
  FROM public.categories
  WHERE id = v_category_id AND active = true
  FOR UPDATE;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.registrations
  WHERE category_id = v_category_id
    AND status IN ('pending','confirmed');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'SLOTS_FULL';
  END IF;

  -- Unique voucher
  LOOP
    v_voucher := public.generate_voucher_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.registrations WHERE voucher_code = v_voucher);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN RAISE EXCEPTION 'VOUCHER_GEN_FAILED'; END IF;
  END LOOP;

  INSERT INTO public.registrations (
    voucher_code, category_id, contact_email,
    athlete1_name, athlete1_phone, athlete1_shirt_size,
    athlete2_name, athlete2_phone, athlete2_shirt_size
  ) VALUES (
    v_voucher, v_category_id, lower(payload->>'contact_email'),
    payload->>'athlete1_name', payload->>'athlete1_phone', (payload->>'athlete1_shirt_size')::public.shirt_size,
    payload->>'athlete2_name', payload->>'athlete2_phone', (payload->>'athlete2_shirt_size')::public.shirt_size
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'voucher_code', v_voucher);
END;
$$;

REVOKE ALL ON FUNCTION public.create_registration(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.create_registration(jsonb) TO anon, authenticated;

-- get_registration_by_voucher (public)
CREATE OR REPLACE FUNCTION public.get_registration_by_voucher(_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(r) || jsonb_build_object(
    'category', to_jsonb(c),
    'championship', to_jsonb(ch)
  )
  FROM public.registrations r
  JOIN public.categories c ON c.id = r.category_id
  JOIN public.championships ch ON ch.id = c.championship_id
  WHERE r.voucher_code = upper(_code)
$$;

REVOKE ALL ON FUNCTION public.get_registration_by_voucher(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_registration_by_voucher(text) TO anon, authenticated;

-- get_category_availability
CREATE OR REPLACE FUNCTION public.get_category_availability(_category_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(c.max_slots - (
    SELECT count(*) FROM public.registrations r
    WHERE r.category_id = c.id AND r.status IN ('pending','confirmed')
  ), 0)::int
  FROM public.categories c WHERE c.id = _category_id
$$;

GRANT EXECUTE ON FUNCTION public.get_category_availability(uuid) TO anon, authenticated;

-- confirm/cancel registration (admin)
CREATE OR REPLACE FUNCTION public.confirm_registration(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.registrations SET status = 'confirmed' WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_registration(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.registrations SET status = 'cancelled' WHERE id = _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_registration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration(uuid) TO authenticated;

-- confirm by payment (used by webhook via service role)
CREATE OR REPLACE FUNCTION public.confirm_registration_by_payment(_payment_id text, _registration_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.registrations
  SET status = 'confirmed', payment_id = _payment_id
  WHERE id = _registration_id;
END;
$$;
