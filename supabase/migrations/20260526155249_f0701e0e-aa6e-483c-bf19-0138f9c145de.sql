
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS manual_confirmation_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_confirmation_note TEXT,
  ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.confirm_registration(
  _id uuid,
  _reason text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.registrations
  SET status = 'confirmed',
      manual_confirmation_reason = COALESCE(_reason, manual_confirmation_reason),
      manual_confirmation_note = COALESCE(_note, manual_confirmation_note),
      payment_method = CASE WHEN _reason = 'cash' THEN 'cash' ELSE payment_method END
  WHERE id = _id;
END;
$function$;
