-- Add confirmed_at and installments to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;

-- Update confirm_registration_by_payment to stamp confirmed_at
CREATE OR REPLACE FUNCTION public.confirm_registration_by_payment(
  _payment_id text,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.registrations
  SET
    status = 'confirmed',
    asaas_payment_id = COALESCE(asaas_payment_id, _payment_id),
    confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = _registration_id;
END;
$$;

-- Update set_registration_payer to save installments
CREATE OR REPLACE FUNCTION public.set_registration_payer(
  _id uuid,
  _cpf text,
  _postal_code text,
  _payment_method text,
  _installments integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.registrations
  SET
    payer_cpf      = COALESCE(_cpf, payer_cpf),
    payer_postal_code = COALESCE(_postal_code, payer_postal_code),
    payment_method = COALESCE(_payment_method, payment_method),
    installments   = COALESCE(_installments, installments)
  WHERE id = _id;
END;
$$;
