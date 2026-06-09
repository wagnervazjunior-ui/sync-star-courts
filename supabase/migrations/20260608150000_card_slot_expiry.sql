-- Limite de 15 minutos para vagas reservadas por tentativa de cartão
--
-- Quando payment_method = 'credit_card', setamos pix_expires_at = now().
-- A release_expired_registrations já cancela pendings com
-- pix_expires_at < now() - 15min, liberando a vaga em até 20 min
-- (15 min de carência + janela do cron de 5 min).
-- Inscrições confirmadas ou em análise (processing) não são afetadas.

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
    payer_cpf         = COALESCE(_cpf, payer_cpf),
    payer_postal_code = COALESCE(_postal_code, payer_postal_code),
    payment_method    = COALESCE(_payment_method, payment_method),
    installments      = COALESCE(_installments, installments),
    pix_expires_at    = CASE
                          WHEN _payment_method = 'credit_card' THEN now()
                          ELSE pix_expires_at
                        END
  WHERE id = _id;
END;
$$;

-- Remove o filtro de payment_method do cron de limpeza para incluir
-- pendings de cartão expirados (pix_expires_at IS NOT NULL continua obrigatório,
-- então inscrições sem tentativa de pagamento não são afetadas).
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
      AND pix_expires_at IS NOT NULL
      AND pix_expires_at < now() - interval '15 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END $function$;
