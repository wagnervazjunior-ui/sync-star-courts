
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_cents int;

CREATE INDEX IF NOT EXISTS registrations_asaas_payment_id_idx
  ON public.registrations(asaas_payment_id);

CREATE OR REPLACE FUNCTION public.set_registration_pix(
  _id uuid,
  _payment_id text,
  _customer_id text,
  _qr text,
  _qr_b64 text,
  _expires_at timestamptz,
  _amount_cents int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.registrations
  SET asaas_payment_id = _payment_id,
      asaas_customer_id = _customer_id,
      pix_qr_code = _qr,
      pix_qr_code_base64 = _qr_b64,
      pix_expires_at = _expires_at,
      amount_cents = COALESCE(_amount_cents, amount_cents)
  WHERE id = _id;
END;
$$;

-- Allow public read of own registration by voucher already exists via RPC.
-- Add a public SELECT policy scoped only to records being looked up by voucher via RPC.
-- The RPC get_registration_by_voucher is SECURITY DEFINER, so no extra policy is required for fetching by voucher.

-- Realtime
ALTER TABLE public.registrations REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'registrations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations';
  END IF;
END$$;

-- Update get_registration_by_voucher to expose pix fields (already returns to_jsonb(r)).
-- Update confirm_registration_by_payment to also clear pix expiry not required.
