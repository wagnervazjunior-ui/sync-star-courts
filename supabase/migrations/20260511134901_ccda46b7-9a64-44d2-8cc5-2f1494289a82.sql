-- Add 'processing' to registration_status enum (for credit card under risk analysis)
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'processing';

-- Add new columns for credit card payments and payer info
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS payer_cpf text,
  ADD COLUMN IF NOT EXISTS payer_postal_code text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS installments integer NOT NULL DEFAULT 1;

-- Update release_expired_registrations: do NOT cancel credit_card pendings (they have no pix_expires_at)
CREATE OR REPLACE FUNCTION public.release_expired_registrations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.registrations
    SET status = 'cancelled'
    WHERE status = 'pending'
      AND (payment_method IS NULL OR payment_method = 'pix')
      AND pix_expires_at IS NOT NULL
      AND pix_expires_at < now() - interval '15 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END $function$;

-- Helper to set payer info for a registration (called from server function before charging card)
CREATE OR REPLACE FUNCTION public.set_registration_payer(
  _id uuid,
  _cpf text,
  _postal_code text,
  _payment_method text,
  _installments integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.registrations
  SET payer_cpf = COALESCE(_cpf, payer_cpf),
      payer_postal_code = COALESCE(_postal_code, payer_postal_code),
      payment_method = COALESCE(_payment_method, payment_method),
      installments = COALESCE(_installments, installments)
  WHERE id = _id;
END $function$;

-- Update confirm_registration_by_payment to also clear pix fields when card confirms
CREATE OR REPLACE FUNCTION public.confirm_registration_by_payment(_payment_id text, _registration_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.registrations
  SET status = 'confirmed',
      asaas_payment_id = COALESCE(asaas_payment_id, _payment_id),
      payment_id = COALESCE(payment_id, _payment_id)
  WHERE id = _registration_id
    AND status <> 'confirmed';
END;
$function$;

-- Set registration to 'processing' status (for cards in risk analysis)
CREATE OR REPLACE FUNCTION public.set_registration_processing(_payment_id text, _registration_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.registrations
  SET status = 'processing',
      asaas_payment_id = COALESCE(asaas_payment_id, _payment_id)
  WHERE id = _registration_id
    AND status NOT IN ('confirmed', 'cancelled');
END;
$function$;