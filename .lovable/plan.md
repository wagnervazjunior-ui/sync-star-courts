## Diagnóstico

Três problemas distintos:

### 1. Botão WhatsApp aparece antes da confirmação
Em `src/routes/sucesso.$voucher.tsx`, o botão é renderizado sempre que existe `contact_phone`, independente do status. Precisa ficar visível **só quando `isConfirmed === true`**.

### 2. WhatsApp "não funciona"
O link usa `window.open(..., "_blank")`. Provável causa: bloqueio de popup ou número mal formatado quando o telefone salvo já vem com `55` ou com `+`. Vou trocar para um `<a target="_blank">` (mais confiável que `window.open`) e normalizar o telefone removendo `+` e evitando duplicar `55`.

### 3. Email não sai no PIX nem na confirmação manual
- **PIX (webhook Asaas)**: o webhook *chama* `sendVoucherConfirmationEmail`, mas a função hoje é um **stub** que só faz `console.info` — não envia email nenhum. Por isso não chega no PIX nem no cartão.
- **Confirmação manual (admin)**: a tela `admin.inscricoes.tsx` chama o RPC `confirm_registration` direto do client e **nunca passa pelo helper de email**. Mesmo se o helper estivesse ativo, esse caminho não dispararia nada.

A causa raiz do email é a mesma: a infra de email ainda não foi provisionada (você pediu para deixar o domínio para o final). Sem a infra, nenhum dos três caminhos (PIX, cartão, confirmação manual) consegue mandar email — só loga.

---

## Plano

### A. Ajustes de UI (imediato, sem depender de email)

**`src/routes/sucesso.$voucher.tsx`**
- Mostrar o botão "Enviar voucher pelo WhatsApp" **apenas quando `isConfirmed`** (não mais em pending/processing).
- Trocar `window.open` por `<Button asChild><a href=... target="_blank" rel="noopener noreferrer">`.
- Normalizar telefone: remover tudo que não é dígito, remover `+`, e só prefixar `55` se ainda não começar com `55` E o número tiver 10–11 dígitos (DDD + número BR). Mensagem pré-preenchida fica como está.

### B. Disparar email também na confirmação manual do admin

Criar server function `confirmRegistrationManually` em `src/lib/payments.functions.ts` (ou em um novo `src/lib/admin.functions.ts`) protegida por `requireSupabaseAuth`, que:
1. Chama `confirm_registration` (RPC já existente).
2. Em sucesso, chama `sendVoucherConfirmationEmail(registrationId)` dentro de try/catch (não quebra se email falhar).

Atualizar `src/routes/admin.inscricoes.tsx` para usar essa server function no botão de confirmar (cancelar continua usando RPC direto).

### C. Ativar envio de email real (PIX, cartão e confirmação manual)

A chamada já existe nos três caminhos; só falta a infra. Proponho fazer agora o setup mínimo de infra de email **usando o domínio padrão Lovable** (sem precisar configurar `opensync.com.br` ainda):

1. **Setup da infra de email** (cria filas, dispatcher, tabelas, cron).
2. **Scaffold de email transacional** (cria as rotas `send-transactional-email`, suppression, unsubscribe).
3. **Criar template React Email** `voucher-confirmed.tsx` em `src/lib/email-templates/`:
   - Assunto: `Inscrição confirmada — {Campeonato} • Voucher {OS-XXXXXX}`
   - Corpo: voucher em destaque, dupla, categoria, valor, link da página de sucesso.
4. **Substituir o stub** `src/lib/email/send-voucher.server.ts` por uma implementação real que:
   - Lê os dados da inscrição.
   - Chama internamente a rota `send-transactional-email` com `templateName: "voucher-confirmed"`, `recipientEmail: contact_email`, `idempotencyKey: voucher-confirmed-{registrationId}`, e `templateData` com os campos do voucher.
   - Continua dentro de try/catch (webhook não pode quebrar).
5. **Página `/unsubscribe`** simples (requisito do scaffold).

Resultado: emails passam a sair imediatamente, vindos do remetente padrão Lovable. Quando você quiser, configuramos `opensync.com.br` como sender — basta o setup do domínio, sem mexer no código.

---

## Detalhes técnicos

**Arquivos afetados**
- `src/routes/sucesso.$voucher.tsx` — esconder WhatsApp até confirmar; link via `<a>`.
- `src/lib/payments.functions.ts` (ou novo `src/lib/admin.functions.ts`) — nova `confirmRegistrationManually`.
- `src/routes/admin.inscricoes.tsx` — usar a server fn no confirmar.
- `src/lib/email/send-voucher.server.ts` — chamar rota transacional real.
- `src/lib/email-templates/voucher-confirmed.tsx` (novo) + `registry.ts`.
- Rotas de email transacional + `/unsubscribe` (geradas pelo scaffold).

**Idempotência**: `voucher-confirmed-{registration_id}` evita duplicatas em re-entrega de webhook ou múltiplos cliques de confirmar.

---

## Alternativa, se preferir adiar o email

Se você ainda quiser deixar TODO o email para o final junto com o domínio, posso entregar agora **só A + B** (WhatsApp corrigido + confirmação manual passando pelo helper de email), e o helper continua como stub — assim, no dia que ativarmos a infra, os três caminhos já vão funcionar sem mais alterações de código.

Qual prefere?
1. **Plano completo (A + B + C)** — email já funciona hoje, sem domínio próprio.
2. **Só A + B agora** — email só liga quando configurarmos `opensync.com.br` no final.
