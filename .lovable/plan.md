# Plano aprovado — Confirmação manual, voucher e e-mail

## 1. Justificativa na confirmação manual (admin)

Diálogo ao clicar em "Confirmar" em `/admin/inscricoes` com as opções:

- Pagamento em dinheiro → grava `payment_method = 'cash'` na inscrição
- Patrocinador
- Vaga cortesia
- Outro (campo livre obrigatório)

A justificativa fica gravada e aparece como badge/tooltip no card de cada inscrição confirmada manualmente.

### Detalhes técnicos
- **Migration**: colunas `manual_confirmation_reason TEXT`, `manual_confirmation_note TEXT`, `last_email_sent_at TIMESTAMPTZ` em `public.registrations`.
- **Atualizar RPC** `confirm_registration(_id, _reason, _note)` para gravar a justificativa, manter check `has_role(...,'admin')` e setar `payment_method='cash'` quando reason='cash'.
- **Server fn** `confirmRegistrationManually` aceita `{ registrationId, reason, note? }`, valida com Zod, chama a RPC e dispara `sendVoucherConfirmationEmail`.
- **UI** em `admin.inscricoes.tsx`: `AlertDialog` + `RadioGroup` + textarea condicional. Exibir reason no card.

## 2. Ações na página `/voucher/$id`

Botões no topo:
- **Reenviar e-mail** (só se `confirmed`)
- **Baixar voucher** (`window.print()` — mantém)

### Detalhes técnicos
- Nova server fn pública `resendVoucherEmail({ id })` em `src/lib/voucher.functions.ts`. Só envia se `status === 'confirmed'`. Rate-limit por `last_email_sent_at` (mínimo 60s entre envios).
- `sendVoucherConfirmationEmail` atualiza `last_email_sent_at` após envio bem-sucedido.

## 3. Diagnóstico do e-mail não enviado

Provável causa: `from: onboarding@resend.dev` (sandbox Resend) só entrega para o e-mail dono da conta. Para outros destinatários a API retorna erro silencioso (apenas log).

### Ações
- Verificar logs do server fn confirmando o erro 403/422 da Resend.
- Melhorar log de erro em `send-voucher.server.ts` (incluir status + body).
- Recomendar verificação de domínio próprio no Resend (conduzido em loop futuro quando tiver acesso ao DNS).

## Ordem de execução

1. Migration (3 colunas + atualização do RPC `confirm_registration`).
2. Atualizar `confirmRegistrationManually` + UI do diálogo no admin.
3. Criar `resendVoucherEmail` + botões na página do voucher.
4. Diagnosticar logs do Resend e informar próximos passos para domínio próprio.
