
-- Championships: uniform models list
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS uniform_models text[] NOT NULL DEFAULT '{}';

-- Categories: gender + uniform model
DO $$ BEGIN
  CREATE TYPE public.category_gender AS ENUM ('male','female','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS gender public.category_gender NOT NULL DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS uniform_model text;

-- Registrations: team name, single phone, shorts size, drop individual phones
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS athlete1_shorts_size public.shirt_size,
  ADD COLUMN IF NOT EXISTS athlete2_shorts_size public.shirt_size;

-- Backfill shorts size from shirt size for any existing rows
UPDATE public.registrations
   SET athlete1_shorts_size = COALESCE(athlete1_shorts_size, athlete1_shirt_size),
       athlete2_shorts_size = COALESCE(athlete2_shorts_size, athlete2_shirt_size);

-- Backfill contact_phone from athlete1_phone if present
UPDATE public.registrations
   SET contact_phone = COALESCE(NULLIF(contact_phone,''), athlete1_phone, '');

ALTER TABLE public.registrations
  ALTER COLUMN athlete1_shorts_size SET NOT NULL,
  ALTER COLUMN athlete2_shorts_size SET NOT NULL;

ALTER TABLE public.registrations
  DROP COLUMN IF EXISTS athlete1_phone,
  DROP COLUMN IF EXISTS athlete2_phone;

-- Update create_registration RPC
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
BEGIN
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

  LOOP
    v_voucher := public.generate_voucher_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.registrations WHERE voucher_code = v_voucher);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN RAISE EXCEPTION 'VOUCHER_GEN_FAILED'; END IF;
  END LOOP;

  INSERT INTO public.registrations (
    voucher_code, category_id, contact_email, contact_phone, team_name,
    athlete1_name, athlete1_shirt_size, athlete1_shorts_size,
    athlete2_name, athlete2_shirt_size, athlete2_shorts_size
  ) VALUES (
    v_voucher, v_category_id, lower(payload->>'contact_email'),
    payload->>'contact_phone', payload->>'team_name',
    payload->>'athlete1_name',
    (payload->>'athlete1_shirt_size')::public.shirt_size,
    (payload->>'athlete1_shorts_size')::public.shirt_size,
    payload->>'athlete2_name',
    (payload->>'athlete2_shirt_size')::public.shirt_size,
    (payload->>'athlete2_shorts_size')::public.shirt_size
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'voucher_code', v_voucher);
END;
$function$;
