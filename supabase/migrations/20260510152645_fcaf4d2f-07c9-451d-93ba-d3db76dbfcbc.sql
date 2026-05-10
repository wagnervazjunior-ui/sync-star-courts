
-- 1) Fix public select policy: only truly active championships are public
DROP POLICY IF EXISTS championships_select_public ON public.championships;
CREATE POLICY championships_select_public
ON public.championships
FOR SELECT
TO public
USING (active = true);

-- 2) RPC: list championships visible/manageable for current admin
CREATE OR REPLACE FUNCTION public.list_manageable_championships()
RETURNS SETOF public.championships
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.championships c
  WHERE
    public.has_role(auth.uid(), 'master'::public.app_role)
    OR c.created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.championship_admins ca
      WHERE ca.championship_id = c.id AND ca.user_id = auth.uid()
    )
  ORDER BY c.created_at DESC
$$;

-- 3) RPC: release expired pending registrations
CREATE OR REPLACE FUNCTION public.release_expired_registrations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.registrations
    SET status = 'cancelled'
    WHERE status = 'pending'
      AND pix_expires_at IS NOT NULL
      AND pix_expires_at < now() - interval '15 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END $$;

-- 4) create_registration: ignore clearly expired pending slots
CREATE OR REPLACE FUNCTION public.create_registration(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND (
      status = 'confirmed'
      OR (
        status = 'pending'
        AND (pix_expires_at IS NULL OR pix_expires_at > now() - interval '15 minutes')
      )
    );

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'SLOTS_FULL';
  END IF;

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
END $function$;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS registrations_category_status_idx
  ON public.registrations (category_id, status);
CREATE INDEX IF NOT EXISTS registrations_pix_expires_idx
  ON public.registrations (pix_expires_at)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS registrations_asaas_payment_id_uniq
  ON public.registrations (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

-- 6) Schedule cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-expired-registrations') THEN
    PERFORM cron.unschedule('release-expired-registrations');
  END IF;
  PERFORM cron.schedule(
    'release-expired-registrations',
    '*/5 * * * *',
    $cron$ SELECT public.release_expired_registrations(); $cron$
  );
END $$;
