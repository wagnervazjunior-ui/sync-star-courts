## Estratégia: preparar tudo agora, plugar a conta Asaas depois

Você não precisa da conta Asaas criada para adiantarmos ~90% do trabalho. Vamos preparar banco, código, rotas e UI. Quando você criar a conta:

1. Você cria a conta no Asaas (sandbox primeiro).
2. Pega a API Key no painel.
3. Me avisa — peço o segredo `ASAAS_API_KEY` por formulário seguro (não por chat).
4. Você cola a URL do webhook (que já vou ter pronta) no painel Asaas + define o token.
5. Testa um PIX de R$ 0,01 no sandbox.

Enquanto isso, **tudo que não depende da chave fica pronto e testável** — inclusive a tela de PIX com QRCode usando dados mockados.

---

## Diagnóstico do bug "não consigo abrir o campeonato sem ser admin"

Não é bug de permissão. O campeonato `Estação Open - Brasília` está `active = true` e a policy pública permite leitura. O problema é que no admin não há link para a página pública (`/campeonatos/<slug>`), então parece bloqueado. Vou adicionar um botão "Ver página pública" + avisos quando o campeonato estiver inativo ou sem categorias ativas.

---

## Sobre a chave: `ASAAS_API_KEY`, NÃO `VITE_ASAAS_API_KEY`

Importante: **não usar prefixo `VITE_`**. Tudo com `VITE_*` vai parar no bundle do navegador, ou seja, qualquer pessoa veria sua chave do Asaas no DevTools e poderia criar cobranças no seu nome. A chave fica como segredo runtime, só acessível no servidor. O frontend nunca toca nela — só chama nosso endpoint.

---

## Plano

### Fase 1 — Pronto AGORA (sem depender da conta Asaas)

#### 1.1 Migration de banco
- Adicionar em `registrations`:
  - `asaas_payment_id text` (id da cobrança no Asaas)
  - `asaas_customer_id text` (id do cliente no Asaas)
  - `pix_qr_code text` (copia-e-cola)
  - `pix_qr_code_base64 text` (imagem do QRCode)
  - `pix_expires_at timestamptz`
  - `amount_cents int` (valor cobrado, snapshot da categoria)
- Nova RPC `set_registration_pix(_id, _payment_id, _customer_id, _qr, _qr_b64, _expires_at)` — SECURITY DEFINER, usada pelo server.
- A RPC `confirm_registration_by_payment` já existe — manter.
- Habilitar Realtime na tabela `registrations` para a tela de sucesso saber na hora que o pagamento entrou.

#### 1.2 Estrutura de código (com modo "fake" enquanto não há chave)
- `src/lib/asaas.server.ts` — wrapper da API Asaas (`createCustomer`, `createPixCharge`, `getPixQrCode`).
  - Lê `ASAAS_API_KEY` e `ASAAS_ENV` (`sandbox` | `production`).
  - **Se a chave não estiver definida, opera em modo MOCK**: retorna QRCode de exemplo e payload PIX fake. Assim conseguimos ver a tela funcionando antes de criar a conta.
- `src/lib/payments.functions.ts` — server function `createPixCharge({ registrationId })`:
  - Busca inscrição + categoria + atleta1.
  - Cria/recupera customer no Asaas.
  - Cria cobrança PIX (`externalReference = registration_id`).
  - Salva via `set_registration_pix`.
  - Retorna `{ qrCodeBase64, payload, expiresAt }`.

#### 1.3 Server route `/api/public/asaas-webhook` (já com URL estável)
- `POST` recebe evento Asaas.
- Valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN` (timing-safe).
- Valida body com Zod.
- Idempotente: `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → `confirm_registration_by_payment`. `PAYMENT_REFUNDED`/`PAYMENT_DELETED` → `cancel_registration`.
- Responde 200.
- **URL final que você vai colar no painel Asaas**:
  `https://project--99e9256e-6199-4540-afcf-feabc3117e21.lovable.app/api/public/asaas-webhook`

#### 1.4 Frontend — tela `/sucesso/$voucher` reformulada
- Se `status = pending` e ainda sem QRCode → botão **"Gerar PIX"** chama `createPixCharge`.
- Mostra QRCode (`<img src="data:image/png;base64,..." />`) + Copia-e-cola com botão "Copiar".
- Mostra valor e prazo de expiração.
- **Realtime** na linha da inscrição: quando `status` virar `confirmed`, troca tela para "Pagamento confirmado!".
- Botão fallback "Já paguei, atualizar".
- Em modo MOCK, mostra um aviso amarelo: "Modo simulação — configure a chave Asaas para cobranças reais".

#### 1.5 Bug do acesso público + descoberta
- Botão "Ver página pública" no `/admin/campeonatos/$id` (abre `/campeonatos/<slug>` em nova aba).
- Aviso quando o campeonato está inativo / sem categorias ativas.
- `/campeonatos/$slug` mostrar mensagem clara quando não há categorias.

### Fase 2 — Quando você criar a conta Asaas

1. Você cria a conta (recomendo começar em **sandbox**: `https://sandbox.asaas.com`).
2. Pega a API Key em "Integrações → Chave de API".
3. Eu peço via formulário seguro: `ASAAS_API_KEY`, `ASAAS_ENV` (`sandbox`), `ASAAS_WEBHOOK_TOKEN` (uma string aleatória que você inventa).
4. Você vai no painel Asaas → "Integrações → Webhooks":
   - URL: a que vou ter pronta acima.
   - Token: o mesmo `ASAAS_WEBHOOK_TOKEN`.
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`.
5. Faz uma inscrição teste, paga R$ 0,01 com seu PIX → confirma que a tela atualiza sozinha.

### Fase 3 — Próximos passos (depois do PIX funcionando)

- Admin de inscrições (`/admin/inscricoes`) com filtros, ações (confirmar/cancelar/copiar voucher/reabrir QR), CSV export.
- Inscrição mais robusta: bloquear quando lotado, máscara de telefone, realtime de vagas.
- Recuperação de senha (`/esqueci-senha` + `/reset-password`).
- E-mail de confirmação com voucher (precisa de domínio configurado — pergunto antes).

### Fora do escopo

- Cartão de crédito / boleto (você pediu só PIX).
- Estorno automático.
- Crop de imagem no cliente.

---

## Posso começar pela Fase 1?

Confirme e eu já começo pela migration + código com modo mock. Você consegue ver a tela de PIX funcionando hoje, mesmo sem a conta Asaas.
