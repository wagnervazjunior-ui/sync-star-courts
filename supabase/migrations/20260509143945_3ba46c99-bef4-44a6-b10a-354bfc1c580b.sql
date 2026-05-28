-- 1. Categorias: regra de idade
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS age_rule_mode text NOT NULL DEFAULT 'none'
    CHECK (age_rule_mode IN ('none','individual_min','sum_min')),
  ADD COLUMN IF NOT EXISTS age_min integer;

-- 2. Inscrições: datas de nascimento
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS athlete1_birthdate date,
  ADD COLUMN IF NOT EXISTS athlete2_birthdate date;

-- 3. Campeonatos: created_by + trigger
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION public.set_championship_created_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_championship_created_by ON public.championships;
CREATE TRIGGER trg_set_championship_created_by
BEFORE INSERT ON public.championships
FOR EACH ROW EXECUTE FUNCTION public.set_championship_created_by();

-- 4. Tabela de administradores por campeonato
CREATE TABLE IF NOT EXISTS public.championship_admins (
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (championship_id, user_id)
);

ALTER TABLE public.championship_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS championship_admins_master_all ON public.championship_admins;
CREATE POLICY championship_admins_master_all ON public.championship_admins
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));

DROP POLICY IF EXISTS championship_admins_select_self ON public.championship_admins;
CREATE POLICY championship_admins_select_self ON public.championship_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'::public.app_role));

-- 5. Função de checagem de acesso a um campeonato
CREATE OR REPLACE FUNCTION public.can_view_championship(_user_id uuid, _championship_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'master'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.championships WHERE id = _championship_id AND created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.championship_admins WHERE championship_id = _championship_id AND user_id = _user_id);
$$;

-- 6. RLS - championships
DROP POLICY IF EXISTS championships_admin_all ON public.championships;
CREATE POLICY championships_admin_select_admin ON public.championships
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.can_view_championship(auth.uid(), id));

CREATE POLICY championships_admin_insert ON public.championships
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY championships_admin_update ON public.championships
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.can_view_championship(auth.uid(), id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.can_view_championship(auth.uid(), id));

CREATE POLICY championships_admin_delete ON public.championships
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.can_view_championship(auth.uid(), id));

-- 7. RLS - categories
DROP POLICY IF EXISTS categories_admin_all ON public.categories;
CREATE POLICY categories_admin_all ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.can_view_championship(auth.uid(), championship_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND public.can_view_championship(auth.uid(), championship_id));

-- 8. RLS - registrations
DROP POLICY IF EXISTS registrations_admin_select ON public.registrations;
DROP POLICY IF EXISTS registrations_admin_update ON public.registrations;
CREATE POLICY registrations_admin_select ON public.registrations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = registrations.category_id
        AND public.can_view_championship(auth.uid(), c.championship_id)
    )
  );
CREATE POLICY registrations_admin_update ON public.registrations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = registrations.category_id
        AND public.can_view_championship(auth.uid(), c.championship_id)
    )
  );

-- 9. RPCs de gerenciamento de admins de campeonato
CREATE OR REPLACE FUNCTION public.list_championship_admins(_championship_id uuid)
RETURNS TABLE(user_id uuid, email text, granted_by uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'master'::public.app_role)
          OR EXISTS (SELECT 1 FROM public.championships WHERE id = _championship_id AND created_by = auth.uid())) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT ca.user_id, u.email::text, ca.granted_by, ca.created_at
  FROM public.championship_admins ca
  JOIN auth.users u ON u.id = ca.user_id
  WHERE ca.championship_id = _championship_id
  ORDER BY ca.created_at ASC;
END $$;

CREATE OR REPLACE FUNCTION public.grant_championship_admin(_championship_id uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  INSERT INTO public.championship_admins (championship_id, user_id, granted_by)
  VALUES (_championship_id, v_user_id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('user_id', v_user_id, 'email', _email);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_championship_admin(_championship_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  DELETE FROM public.championship_admins
  WHERE championship_id = _championship_id AND user_id = _user_id;
END $$;

-- 10. create_registration com validação de idade
CREATE OR REPLACE FUNCTION public.create_registration(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category_id uuid := (payload->>'category_id')::uuid;
  v_max int;
  v_count int;
  v_voucher text;
  v_id uuid;
  v_attempts int := 0;
  v_age_mode text;
  v_age_min int;
  v_championship_year int;
  v_b1 date;
  v_b2 date;
  v_a1 int;
  v_a2 int;
BEGIN
  SELECT max_slots, age_rule_mode, age_min INTO v_max, v_age_mode, v_age_min
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

  -- Age validation
  IF v_age_mode IS NOT NULL AND v_age_mode <> 'none' THEN
    SELECT COALESCE(extract(year from ch.start_date)::int, extract(year from now())::int)
      INTO v_championship_year
    FROM public.categories c
    JOIN public.championships ch ON ch.id = c.championship_id
    WHERE c.id = v_category_id;

    v_b1 := NULLIF(payload->>'athlete1_birthdate','')::date;
    v_b2 := NULLIF(payload->>'athlete2_birthdate','')::date;
    IF v_b1 IS NULL OR v_b2 IS NULL THEN
      RAISE EXCEPTION 'BIRTHDATE_REQUIRED';
    END IF;
    v_a1 := v_championship_year - extract(year from v_b1)::int;
    v_a2 := v_championship_year - extract(year from v_b2)::int;

    IF v_age_mode = 'individual_min' AND (v_a1 < v_age_min OR v_a2 < v_age_min) THEN
      RAISE EXCEPTION 'AGE_RULE_VIOLATION';
    END IF;
    IF v_age_mode = 'sum_min' AND (v_a1 + v_a2) < v_age_min THEN
      RAISE EXCEPTION 'AGE_RULE_VIOLATION';
    END IF;
  END IF;

  LOOP
    v_voucher := public.generate_voucher_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.registrations WHERE voucher_code = v_voucher);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN RAISE EXCEPTION 'VOUCHER_GEN_FAILED'; END IF;
  END LOOP;

  INSERT INTO public.registrations (
    voucher_code, category_id, contact_email, contact_phone, team_name,
    athlete1_name, athlete1_shirt_size, athlete1_shorts_size, athlete1_birthdate,
    athlete2_name, athlete2_shirt_size, athlete2_shorts_size, athlete2_birthdate
  ) VALUES (
    v_voucher, v_category_id, lower(payload->>'contact_email'),
    payload->>'contact_phone', payload->>'team_name',
    payload->>'athlete1_name',
    (payload->>'athlete1_shirt_size')::public.shirt_size,
    (payload->>'athlete1_shorts_size')::public.shirt_size,
    NULLIF(payload->>'athlete1_birthdate','')::date,
    payload->>'athlete2_name',
    (payload->>'athlete2_shirt_size')::public.shirt_size,
    (payload->>'athlete2_shorts_size')::public.shirt_size,
    NULLIF(payload->>'athlete2_birthdate','')::date
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'voucher_code', v_voucher);
END $$;