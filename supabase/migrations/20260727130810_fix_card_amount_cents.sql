-- Inscrições pagas por cartão nunca gravavam amount_cents (só o PIX gravava,
-- via set_registration_pix). O dashboard soma amount_cents das confirmadas,
-- então todo pagamento por cartão contava R$ 0 de receita.
--
-- Alinha set_registration_payer ao mesmo padrão do set_registration_pix:
-- recebe e grava o valor cobrado no momento da tentativa de pagamento.

CREATE OR REPLACE FUNCTION public.set_registration_payer(
  _id uuid,
  _cpf text,
  _postal_code text,
  _payment_method text,
  _installments integer DEFAULT 1,
  _amount_cents integer DEFAULT NULL
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
    amount_cents      = COALESCE(_amount_cents, amount_cents),
    pix_expires_at    = CASE
                          WHEN _payment_method = 'credit_card' THEN now()
                          ELSE pix_expires_at
                        END
  WHERE id = _id;
END;
$$;

-- Backfill: inscrições já confirmadas por cartão com amount_cents nulo.
-- Não há registro histórico do valor exato cobrado por parcela nessas
-- inscrições, então usamos o preço atual da categoria como melhor aproximação.
UPDATE public.registrations r
SET amount_cents = c.price_cents
FROM public.categories c
WHERE r.category_id = c.id
  AND r.status = 'confirmed'
  AND r.payment_method = 'credit_card'
  AND r.amount_cents IS NULL
  AND c.price_cents IS NOT NULL;
