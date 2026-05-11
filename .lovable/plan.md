## Ativar integração Asaas em sandbox — PIX + Cartão de Crédito

Vamos colocar a integração Asaas no ar em ambiente de testes (sandbox) com **dois meios de pagamento**: PIX (já implementado) e **Cartão de Crédito** (a implementar). O wrapper Asaas já existe; o trabalho de cartão é principalmente UI + uma nova server function + suporte a uma transição de status nova (`processing`).

---

### Passo 1 — Cadastrar os 3 secrets no Lovable Cloud

| Secret | Valor |
|---|---|
| `ASAAS_API_KEY` | sua chave do **sandbox** Asaas (`$aact_hmlg_...`) |
| `ASAAS_ENV` | `sandbox` |
| `ASAAS_WEBHOOK_TOKEN` | string aleatória (`openssl rand -hex 32`) — mesmo valor cola no painel Asaas |

`isAsaasMock()` detecta a presença da chave e desliga o mock automaticamente.

---

### Passo 2 — Implementar Cartão de Crédito (código novo)

Asaas suporta cartão pela mesma API `/payments`, mudando `billingType` para `CREDIT_CARD` e enviando os dados do cartão + `creditCardHolderInfo` (CPF, endereço, etc.). Resposta vem **síncrona**: `CONFIRMED` (aprovado), `AWAITING_RISK_ANALYSIS` (em análise antifraude) ou erro.

**2a. Banco — coletar CPF e suportar status `processing`**

Migration:
- Adicionar colunas em `registrations`: `payer_cpf text`, `payer_postal_code text`, `payment_method text` (`'pix' | 'credit_card'`), `installments int default 1`
- Adicionar valor `'processing'` ao enum `registration_status` (para cartões em análise antifraude)
- Atualizar `create_registration(payload)` pra aceitar `payer_cpf`, `payer_postal_code`, `payment_method`, `installments` no JSON
- Atualizar `release_expired_registrations()` para **não** cancelar inscrições com `payment_method = 'credit_card'` (não tem `pix_expires_at`; cartão recusado já volta erro síncrono)

**2b. Wrapper Asaas (`src/lib/asaas.server.ts`)**

Adicionar função `createCreditCardCharge({ customerId, valueCents, description, externalReference, dueDate, installmentCount, creditCard, creditCardHolderInfo, remoteIp })` que faz `POST /payments` com `billingType: CREDIT_CARD`. Retorna `{ id, status, invoiceUrl }`. Mock retorna status `CONFIRMED` fake pra dev local.

**2c. Server function (`src/lib/payments.functions.ts`)**

Adicionar `createCardCharge` (POST) que:
1. Valida com Zod: `voucher`, `holderName`, `cardNumber`, `expiryMonth`, `expiryYear`, `ccv`, `holderCpf`, `holderEmail`, `holderPhone`, `holderPostalCode`, `holderAddressNumber`, `installments` (1-12)
2. Carrega registration pelo voucher (mesma lógica do `createPixCharge`)
3. `findOrCreateCustomer` no Asaas
4. Chama `createCreditCardCharge` com IP do cliente (`getRequestIP({ xForwardedFor: true })`)
5. Conforme resposta:
   - `CONFIRMED` / `RECEIVED` → marca `status = 'confirmed'` direto
   - `AWAITING_RISK_ANALYSIS` → marca `status = 'processing'` (webhook depois confirma)
   - Erro (cartão recusado) → mantém `pending`, retorna mensagem
6. **Nunca** persiste dados do cartão no nosso banco — só `asaas_payment_id`

**2d. UI — escolha de método na tela de sucesso (`src/routes/sucesso.$voucher.tsx`)**

Atualmente a tela já chama PIX automaticamente. Vamos:
- Adicionar `<Tabs>` no topo do card de pagamento: "PIX" | "Cartão de crédito"
- **Aba PIX**: mantém o fluxo atual (QR + copia-e-cola)
- **Aba Cartão**: novo componente `<CardPaymentForm />` com campos:
  - Dados do cartão: número, validade (MM/AA), CCV, nome impresso
  - Dados do titular: CPF, telefone, CEP, número do endereço
  - Parcelas (1x a 12x — se valor ≥ R$ 10, mostrar opções com juros do Asaas)
  - Botão "Pagar"
- Após submit: loading → resultado (sucesso, em análise, ou erro com mensagem)
- Status `processing` mostra ícone de relógio "Em análise antifraude — você receberá um e-mail em até 1h"

**2e. Webhook (`src/routes/api/public/asaas-webhook.ts`)**

Já cobre `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → `confirmed`. Adicionar tratamento:
- `PAYMENT_AWAITING_RISK_ANALYSIS` → `status = 'processing'`
- `PAYMENT_APPROVED_BY_RISK_ANALYSIS` → `status = 'confirmed'`
- `PAYMENT_REPROVED_BY_RISK_ANALYSIS` → `status = 'cancelled'`

---

### Passo 3 — Configurar webhook no painel Asaas (sandbox)

- **URL:** `https://project--99e9256e-6199-4540-afcf-feabc3117e21.lovable.app/api/public/asaas-webhook`
- **Token:** mesmo `ASAAS_WEBHOOK_TOKEN`
- **Versão:** v3
- **Eventos a marcar:**
  - PIX: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`
  - Cartão: `PAYMENT_AWAITING_RISK_ANALYSIS`, `PAYMENT_APPROVED_BY_RISK_ANALYSIS`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`
  - Comuns: `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `PAYMENT_CHARGEBACK_REQUESTED`

> ⚠️ A URL é estável mas o webhook só responde após o **primeiro publish**. Se ainda não publicou, publicamos antes.

---

### Passo 4 — Teste end-to-end

**Fluxo PIX:**
1. Inscrição → tela voucher → aba PIX → QR real do Asaas
2. Pagar via simulador PIX no painel sandbox
3. Webhook chega → status `confirmed` → tela atualiza via realtime ✅

**Fluxo Cartão (cartões de teste do Asaas sandbox):**
1. Inscrição → tela voucher → aba Cartão → preencher
2. **Cartão aprovado** (`5162306219378829` — Mastercard de teste): resposta síncrona `CONFIRMED` → status `confirmed` na hora ✅
3. **Cartão recusado** (`5184019740373151`): erro inline "Cartão recusado pelo emissor" → permite tentar de novo ✅
4. **Cartão em análise**: status `processing` → simular aprovação no painel → webhook → `confirmed` ✅

Verifico logs com `server-function-logs` filtrando `asaas-webhook` e `payments`.

---

### Passo 5 — Checklist de saída pra produção

- [ ] PIX gera QR real e confirma via webhook
- [ ] Cartão aprovado → confirmação síncrona
- [ ] Cartão recusado → mensagem clara, sem perder a inscrição
- [ ] Cartão em análise → confirma via webhook
- [ ] Realtime atualiza tela sem refresh
- [ ] PIX expirado é cancelado pelo cron (15min após `pix_expires_at`)
- [ ] CPF aparece corretamente no comprovante Asaas
- [ ] Painel admin mostra inscrições + meio de pagamento usado

Quando tudo verde: trocar `ASAAS_API_KEY` (produção) + `ASAAS_ENV=production` + cadastrar mesmo webhook no painel produção.

---

### Detalhes técnicos / arquivos

**Novos / editados:**
- Migration: novas colunas em `registrations`, novo valor no enum, atualizar `create_registration` e `release_expired_registrations`
- `src/lib/asaas.server.ts` — adicionar `createCreditCardCharge`
- `src/lib/payments.functions.ts` — adicionar `createCardCharge`
- `src/routes/api/public/asaas-webhook.ts` — tratar eventos de risk analysis
- `src/routes/sucesso.$voucher.tsx` — adicionar tabs PIX/Cartão
- `src/components/CardPaymentForm.tsx` (novo) — formulário de cartão
- `src/routes/inscricao.$categoryId.tsx` — adicionar campo CPF (opcional na criação, obrigatório se for pagar com cartão; PIX pode pular)

**Não muda:** `payments.functions.ts:createPixCharge`, fluxo realtime, tela do voucher pra PIX

**PCI / segurança:** dados do cartão NUNCA tocam nosso banco. Vão direto do navegador pro `createCardCharge` (server function via HTTPS) → API Asaas → resposta. Asaas é PCI-DSS Level 1, nós só repassamos.

**Decisão pendente sobre parcelamento:** habilitar 1-12x com juros do Asaas (padrão), ou limitar (ex: até 3x sem juros, restante com juros)? Default do plano: **1-12x com juros do Asaas** (mais simples; quem implementa "sem juros" assume o custo).