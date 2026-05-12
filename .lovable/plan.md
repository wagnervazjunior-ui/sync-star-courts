## 1. Frase de garantia do uniforme

Em `src/routes/inscricao.$categoryId.tsx` (linha 227), substituir o texto atual por:

> "Garantimos o tamanho do uniforme para inscrições feitas até {data}. Após essa data, o tamanho fica sujeito à disponibilidade."

A data continua vindo de `championship.shirt_size_guarantee_until` (já formatada). A mensagem para prazo expirado (linha 226) é mantida.

## 2. Permitir mesmo e-mail em mais de uma inscrição

Hoje existe um índice único `registrations_category_id_contact_email_key (category_id, contact_email)` que impede a mesma pessoa de se inscrever duas vezes na mesma categoria — e por extensão também trava quando há tentativas de retry após pending/cancelled. Como a regra do negócio permite que a mesma pessoa jogue mais de uma categoria (e até forme duplas diferentes), vamos remover essa restrição.

**Migração:**
```sql
DROP INDEX IF EXISTS public.registrations_category_id_contact_email_key;
```

Também removo a mensagem de tratamento de erro `"Já existe inscrição com este e-mail"` em `src/routes/inscricao.$categoryId.tsx` (linha 101), já que o caminho `duplicate` deixa de existir.

A unicidade de vaga continua garantida por `voucher_code` único e pelo controle de `max_slots` dentro de `create_registration`.

## 3. Simular pagamento PIX refletindo no painel Asaas

**Problema:** o botão "Simular pagamento (sandbox)" hoje chama o RPC `confirm_registration_by_payment` direto no banco. Isso confirma a inscrição localmente, mas o Asaas não sabe — por isso a cobrança continua "Pendente" no painel sandbox e nenhum webhook é disparado.

**Solução:** usar o endpoint oficial do Asaas `POST /v3/payments/{id}/receiveInCash`, que marca a cobrança como `RECEIVED_IN_CASH` no painel e dispara o webhook `PAYMENT_RECEIVED` normalmente — o webhook então confirma a inscrição pela rota já existente (`/api/public/asaas-webhook`).

**Mudanças:**

- `src/lib/asaas.server.ts`: adicionar helper
  ```ts
  export async function receivePaymentInCash(paymentId: string, valueCents: number)
  ```
  que faz `POST /payments/{paymentId}/receiveInCash` com body `{ paymentDate: hoje (YYYY-MM-DD), value, notifyCustomer: false }`. No modo mock, retorna `{ status: "RECEIVED_IN_CASH" }`.

- `src/lib/payments.functions.ts` — `simulatePayment`:
  - Continuar bloqueando em `ASAAS_ENV === "production"`.
  - Carregar a registration (precisa de `asaas_payment_id` e `amount_cents`).
  - Se houver `asaas_payment_id`, chamar `receivePaymentInCash`. O Asaas vai disparar o webhook que confirma a inscrição.
  - Fallback: se a cobrança ainda não tem `asaas_payment_id` (PIX nunca gerado) ou estamos em modo mock, manter o caminho atual via RPC `confirm_registration_by_payment` para permitir testar o fluxo de UI.
  - Retornar `{ status: "confirmed" | "pending_webhook" }` para a UI mostrar feedback adequado.

- `src/routes/sucesso.$voucher.tsx`: ajustar o toast para "Pagamento simulado — aguardando confirmação do Asaas" quando o resultado for `pending_webhook` (a tela já atualiza sozinha via realtime quando o webhook chega).

### Fora de escopo
- Webhook handler já trata `PAYMENT_RECEIVED` corretamente; não precisa mudar.
- Sem mudanças no fluxo de cartão.
- Sem mudanças em `create_registration` além do índice removido.
