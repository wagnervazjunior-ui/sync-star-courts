-- confirm_registration (usado pelo admin ao confirmar manualmente com motivo
-- cash/sponsor/courtesy/other) nunca gravava amount_cents em nenhum caso.
-- Para sponsor/courtesy/other isso está correto (não houve pagamento, não
-- deve contar como receita). Mas para "cash" (dinheiro recebido de verdade)
-- isso subestimava a receita, do mesmo jeito que o cartão fazia antes.
--
-- Só o caso "cash" passa a gravar o preço da categoria como amount_cents.
-- sponsor/courtesy/other continuam sem gravar valor.

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

  UPDATE public.registrations r
  SET status = 'confirmed',
      manual_confirmation_reason = COALESCE(_reason, r.manual_confirmation_reason),
      manual_confirmation_note = COALESCE(_note, r.manual_confirmation_note),
      payment_method = CASE WHEN _reason = 'cash' THEN 'cash' ELSE r.payment_method END,
      amount_cents = CASE
                       WHEN _reason = 'cash'
                         THEN COALESCE(r.amount_cents, (SELECT c.price_cents FROM public.categories c WHERE c.id = r.category_id))
                       ELSE r.amount_cents
                     END
  WHERE r.id = _id;
END;
$function$;
