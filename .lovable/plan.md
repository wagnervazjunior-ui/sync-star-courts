## Objetivo
1. Melhorar o formulário de pagamento por cartão (CEP autocomplete + complemento).
2. Corrigir erro `user_agent_not_informed` retornado pelo Asaas em todas as chamadas (PIX e cartão).

## Mudanças

### 1. Corrigir User-Agent — `src/lib/asaas.server.ts`
A API do Asaas agora exige o header `User-Agent`. Em `asaasFetch()`, adicionar:
```ts
"User-Agent": "OpenSyncPay/1.0 (+https://sync-star-courts.lovable.app)"
```
Isso resolve tanto o erro atual do PIX quanto qualquer chamada futura (cartão, customer, QR code).

### 2. CEP autocomplete + complemento — `src/components/CardPaymentForm.tsx`
- Ao completar 8 dígitos no CEP, chamar `https://viacep.com.br/ws/{cep}/json/` (público, sem chave, CORS liberado).
- Estado de loading discreto enquanto busca; em caso de erro/CEP inválido, mostrar mensagem e liberar campos para edição manual.
- Novos campos preenchidos automaticamente (editáveis se busca falhar):
  - Logradouro, Bairro, Cidade, UF
- Novo campo opcional: **Complemento** (apto, bloco, etc., máx 60 chars).
- Aumentar limite de `holderAddressNumber` para 20 caracteres (resolve erro anterior de "S/N", "123 fundos" etc.).
- Layout: CEP + Número na mesma linha; Logradouro full-width; Bairro/Cidade/UF em linha; Complemento full-width.

### 3. Server function — `src/lib/payments.functions.ts`
- Estender `CardInput` (Zod) com: `holderAddress`, `holderNeighborhood`, `holderCity`, `holderState` (obrigatórios) e `holderComplement` (opcional, max 60). Aumentar `holderAddressNumber` para max 20.
- Repassar tudo no `creditCardHolderInfo` enviado ao Asaas (campos `address`, `addressNumber`, `complement`, `province`, `city`, `state`).

### 4. Tipo Asaas — `src/lib/asaas.server.ts`
- Estender o tipo `creditCardHolderInfo` da função `createCreditCardCharge` com `address`, `addressNumber`, `complement`, `province`, `city`, `state`.

### Fora de escopo
- Sem mudanças no banco (não persistimos endereço completo; apenas CPF e CEP já são gravados).
- Sem mudanças no fluxo de PIX além do header.
- Sem mudanças no webhook.

## Notas técnicas
- ViaCEP retorna `{ cep, logradouro, bairro, localidade, uf, erro? }`.
- Mapeamento Asaas: `province` = bairro, `city` = cidade, `state` = UF.
- Header `User-Agent` é injetado no helper central, então toda chamada Asaas é coberta automaticamente.
