## Resumo

Adicionar ao plano anterior (Resend + webhook + WhatsApp nativo do Asaas):

5. **Nova página `/voucher/$id`** — voucher oficial com QR Code, print/PDF, e bloqueio se não confirmado.
6. **Email Resend** passa a incluir botão "Acessar Meu Voucher" apontando para `/voucher/$id`.
7. **WhatsApp do Asaas** — passos no painel para customizar a mensagem com o link.

(Itens 1-4 do plano anterior continuam: PAYMENT_OVERDUE, conector Resend, template Athletic Dark Mode, WhatsApp nativo.)

---

## 5. Página pública `/voucher/$id` (mobile-first)

**Arquivo novo**: `src/routes/voucher.$id.tsx` (a rota `/voucher` atual — busca por código — fica como está, só convive).

**Conteúdo**:
- Cabeçalho com logo Open Sync.
- Nome do campeonato + categoria.
- Card da dupla: nome do time, atleta 1 (nome + camiseta + shorts), atleta 2 (idem).
- **QR Code** com o `registration.id` (biblioteca `qrcode.react` — leve, ~5KB).
- Voucher code `OS-XXXXXX` em mono grande.
- Status badge (Confirmado / Pendente / Cancelado).
- Botão topo: **"Salvar em PDF / Imprimir"** → `window.print()` + CSS `@media print` que esconde header/botões e deixa o card limpo numa folha A4.
- Footer com data/local do campeonato.

**Carregamento dos dados**:
- Server function `getVoucherById` (nova, em `src/lib/voucher.functions.ts`) que usa `supabaseAdmin` e retorna apenas campos públicos (sem CPF, sem email/telefone, sem dados de pagamento).
- Como o `id` é um UUID não-adivinhável (gen_random_uuid), o link funciona como token (mesmo padrão da página `/sucesso/$voucher`).

**Segurança / bloqueio**:
- Se `status === 'confirmed'`: renderiza tudo, inclusive QR Code.
- Se `status === 'pending'` ou `processing`: mostra card de aviso "Pagamento ainda não confirmado. O voucher ficará disponível assim que o pagamento for processado." — **sem QR Code**.
- Se `status === 'cancelled'`: mostra "Esta inscrição foi cancelada. Procure a organização se houver dúvidas." — **sem QR Code**.
- Se ID não existe: 404 amigável.

## 6. Email Resend (atualiza item B do plano anterior)

O HTML Athletic Dark Mode passa a ter **dois CTAs**:
- **Botão primário** (laranja, destaque): "🎟️ Acessar Meu Voucher" → `https://{site}/voucher/{registrationId}`
- Link secundário menor: "Consultar por código" → `/sucesso/{voucher_code}`

A URL base vem de `process.env.PUBLIC_SITE_URL` (vou adicionar como secret, default `https://sync-star-courts.lovable.app`).

## 7. WhatsApp via Asaas — passo a passo (sem código)

O Asaas permite **mensagem personalizada por evento** no painel:

1. Painel Asaas → **Configurações → Notificações → WhatsApp**.
2. Ativar evento **"Pagamento confirmado"**.
3. No campo de mensagem customizada, colar:
   ```
   Fala, Atleta! Inscrição CONFIRMADA para a sua dupla no Open Sync! 🔥🏐
   Acesse o link abaixo para visualizar seu voucher oficial, conferir o tamanho das camisetas e apresentar no dia do torneio:
   {linkPagamento}
   Nos vemos na arena!
   ```

**Limitação**: o Asaas usa variáveis dele (`{linkPagamento}`, `{valor}`, `{cliente}`) — **não tem variável para link customizado nosso**. Duas saídas:

- **Opção A (sem código extra)**: usar `{linkPagamento}` (link da fatura Asaas) — atleta clica, vê comprovante, e no comprovante a gente passa o link do voucher via `description` do pagamento. Já estamos preenchendo `description` em `createPixCharge` — vou ajustar pra incluir `Voucher: {site}/voucher/{id}` no texto.
- **Opção B (recomendada se quiser link direto)**: usar **Evolution API** num próximo passo, com mensagem 100% nossa. Fica como evolução futura — não entra agora.

→ Vou implementar **Opção A** agora (ajuste em `createPixCharge` no `src/lib/payments.functions.ts` pra incluir o link no `description`).

---

## Arquivos afetados (acumulado: itens 1-7)

**Novos**:
- `src/routes/voucher.$id.tsx` — página pública do voucher.
- `src/lib/voucher.functions.ts` — server function pública (sem auth) que lê por ID.
- `src/lib/email-templates/voucher-confirmed.ts` — HTML Athletic Dark Mode com botão "Acessar Meu Voucher".

**Editados**:
- `src/routes/api/public/asaas-webhook.ts` — adicionar `PAYMENT_OVERDUE` na branch de cancelamento.
- `src/lib/email/send-voucher.server.ts` — substituir stub por Resend (com URL do voucher).
- `src/lib/payments.functions.ts` — incluir link do voucher no `description` da cobrança PIX/cartão (Opção A do WhatsApp).
- `.lovable/plan.md` — atualizar.

**Dependências**:
- `bun add qrcode.react` (~5KB, sem deps).

**Secrets a adicionar**:
- `PUBLIC_SITE_URL` (ex.: `https://sync-star-courts.lovable.app`).
- (Resend já será conectado via conector — `RESEND_API_KEY` + `LOVABLE_API_KEY` já vêm.)

---

## Ordem de execução

1. Você aprova este plano.
2. Eu disparo o diálogo do conector Resend.
3. Eu peço o secret `PUBLIC_SITE_URL`.
4. Eu instalo `qrcode.react`, crio `/voucher/$id`, `voucher.functions.ts`, template do email, e atualizo webhook + send-voucher + payments.
5. Você ativa as notificações WhatsApp no painel Asaas (passo a passo que mando depois).
