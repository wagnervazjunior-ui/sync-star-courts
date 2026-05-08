# Plano — Open Sync (Gestão de Inscrições Futevôlei)

Sistema multi-campeonato responsivo, tema esportivo escuro premium (laranja/azul areia), backend em **Supabase próprio do cliente**, pagamento Mercado Pago Checkout Pro e e-mails transacionais Lovable Emails.

---

## 1. Backend — Supabase (conta própria do cliente)

> **Importante**: o backend NÃO usará Lovable Cloud. Será conectado um projeto Supabase já existente do cliente. Será solicitado:
> - `VITE_SUPABASE_URL`
> - `VITE_SUPABASE_PUBLISHABLE_KEY` (anon)
> - `SUPABASE_SERVICE_ROLE_KEY` (secret server-side, para webhook do MP)
>
> As migrations SQL serão geradas em `supabase/migrations/` e fornecidas para o cliente aplicar via Supabase CLI ou painel SQL Editor.

### Schema

- **championships**: `id uuid pk`, `name text`, `slug text unique`, `description text` (markdown), `start_date date`, `end_date date`, `location text`, `cover_image_url text`, `active bool default true`, `created_at`.
- **categories**: `id uuid pk`, `championship_id fk → championships ON DELETE CASCADE`, `name text`, `description text` (markdown — premiação/regras/horário), `max_slots int`, `price_cents int`, `active bool default true`, `created_at`. Índice em `championship_id`.
- **registrations**: `id uuid pk`, `voucher_code text unique` (`OS-XXXXXX`), `category_id fk → categories`, `contact_email text`, `athlete1_name/phone/shirt_size`, `athlete2_name/phone/shirt_size`, `status registration_status` (`pending|confirmed|cancelled`), `payment_id text`, `created_at`, `updated_at`. Constraint única `(category_id, contact_email)`.
- **enums**: `shirt_size (P,M,G,GG,XG)`, `registration_status`, `app_role ('admin')`.
- **user_roles**: `id`, `user_id fk auth.users`, `role app_role`, único `(user_id, role)`.
- **has_role(_user_id, _role)**: `SECURITY DEFINER STABLE`, padrão seguro sem recursão de RLS.

### RPCs (concorrência crítica)
- **create_registration(payload jsonb) → text**: `SECURITY DEFINER`. `SELECT ... FOR UPDATE` na categoria, conta `pending+confirmed`, compara com `max_slots`. Cheio → `RAISE EXCEPTION 'SLOTS_FULL'`. Senão gera voucher, insere e retorna.
- **cancel_registration(reg_id)**: admin only (`has_role`). Status → `cancelled` (vaga retorna automaticamente).
- **confirm_registration(reg_id)**: admin only.
- **confirm_registration_by_payment(payment_id, status)**: usada pelo webhook (service role).
- **get_registration_by_voucher(code text)**: pública; retorna voucher + status + categoria + campeonato + dados das duplas.
- **get_category_availability(category_id) → int**: pública; retorna vagas restantes (para badges).

### RLS
- **championships**: SELECT público (apenas `active=true` para anônimos via policy); INSERT/UPDATE/DELETE só admin.
- **categories**: SELECT público; INSERT/UPDATE/DELETE só admin.
- **registrations**: sem acesso público — escrita/leitura pública só via RPCs (SECURITY DEFINER); admin tem SELECT total.
- **user_roles**: SELECT do próprio user; INSERT/DELETE só admin.

---

## 2. Auth
- Supabase Auth e-mail/senha, confirmação desabilitada.
- Bootstrap manual do primeiro admin (instrução pós-deploy: `INSERT INTO user_roles ...` no SQL editor).
- `/login` público.
- Layout `_authenticated/admin.tsx` com `beforeLoad` checando `has_role('admin')` via server fn.

---

## 3. Pagamento — Mercado Pago Checkout Pro
- Secret: `MERCADOPAGO_ACCESS_TOKEN`.
- Server fn `createMpPreference(registrationId)` → chama API MP, devolve `init_point`. Inclui `external_reference = registration.id` e `notification_url`.
- Webhook público: `src/routes/api/public/mp-webhook.ts` (POST). Valida notificação consultando API MP (com access token), se `status=approved` chama `confirm_registration_by_payment` via `supabaseAdmin`.
- `/sucesso/$voucher`: voucher destacado + botão "Pagar agora".

---

## 4. E-mails (Lovable Emails)
Configurar email domain durante a implementação. Templates React Email:
- **registration-created**: voucher, campeonato, categoria, dados das duplas, link consulta, botão Pagar.
- **registration-confirmed**: pagamento confirmado.
- **registration-cancelled**: cancelado pelo admin.

Disparados via helper `sendTransactionalEmail`:
- Após `create_registration` (idempotency: `created-${voucher}`).
- No webhook MP após confirmação (`confirmed-${voucher}`).
- Na ação admin de cancelar (`cancelled-${voucher}`).

---

## 5. Rotas (TanStack file-based, cada uma com `head()` próprio)

### Pública
- `/` — Landing Open Sync: hero, lista dos campeonatos ativos (cards), CTA "Ver campeonatos", "Como funciona", FAQ.
- `/campeonatos` — vitrine de todos os campeonatos ativos (cards com cover, datas, local, status).
- `/campeonatos/$slug` — detalhe do campeonato + lista de categorias com badge de vagas restantes. Botão "Inscrever Dupla" / "Esgotado" por categoria.
- `/inscricao/$categoryId` — formulário (mostra contexto: campeonato + categoria) com react-hook-form + Zod:
  - E-mail de contato da dupla
  - Atleta 1: nome, WhatsApp (máscara `(99) 99999-9999`), tamanho uniforme
  - Atleta 2: idem
  - Submit chama server fn → RPC. Erro `SLOTS_FULL` → toast "Vagas esgotadas".
- `/sucesso/$voucher` — voucher + status + botão pagar.
- `/voucher` — consulta pública por código.

### Admin (`/_authenticated/admin/...`)
- `/admin` — dashboard: seletor de campeonato + totais (inscrições, confirmadas, pendentes, canceladas, receita estimada).
- `/admin/campeonatos` — **CRUD de campeonatos** (nome, slug, descrição, datas, local, cover, ativo).
- `/admin/campeonatos/$id` — detalhe + gestão de categorias do campeonato (CRUD inline).
- `/admin/inscricoes` — tabela com filtros (campeonato → categoria, status, busca por nome/voucher/email). Ações: confirmar, cancelar, ver detalhes (drawer). Botão **"Exportar Planilha Excel"** (escopo: campeonato selecionado) usando `exceljs` no client:
  - Para cada categoria do campeonato: aba `<Categoria> — Ativas` (pending+confirmed) e `<Categoria> — Cancelados`.
  - Colunas: Categoria, Voucher, Status, E-mail Contato, Atleta 1 (Nome/Tel/Uniforme), Atleta 2 (Nome/Tel/Uniforme), Data.
  - Aba **Resumo** com totais por categoria.

---

## 6. Design System (`src/styles.css`, oklch)

- `--background` areia escuro / quase preto, `--foreground` claro.
- `--primary` laranja vibrante, `--accent` azul oceano.
- `--gradient-primary`, `--gradient-hero`, `--gradient-card`.
- `--shadow-elegant`, `--shadow-glow` (glow laranja).
- Variants extras de Button: `hero` (gradiente + glow), `premium` (outline com hover gradiente).
- Tipografia bold (Inter), cards arredondados (`--radius: 1rem`), micro-interações (`tw-animate-css`). Mobile-first.
- Logo placeholder "OPEN SYNC" em SVG inline com gradiente.

---

## 7. Stack & dependências

- TanStack Start + Supabase (conta cliente) + Tailwind v4.
- Adicionar: `@supabase/supabase-js`, `exceljs`, `react-hook-form`, `@hookform/resolvers`.
- Server functions (`createServerFn` + `requireSupabaseAuth`) para ações autenticadas; RPCs Postgres para concorrência atômica.
- Webhook MP em server route público com verificação via API MP.

---

## 8. Ordem de entrega

1. Coletar credenciais Supabase do cliente + configurar env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Gerar migration SQL (schema multi-campeonato, enums, RLS, RPCs com lock) — cliente aplica via Supabase CLI/SQL Editor.
3. Auth admin + layout protegido + `has_role`.
4. Design system (tokens, variants, logo placeholder).
5. UI admin **primeiro**: CRUD de campeonatos → CRUD de categorias por campeonato.
6. UI pública: landing, lista campeonatos, detalhe campeonato/categorias, formulário, sucesso, voucher.
7. UI admin restante: dashboard, gestão inscrições, exportação Excel.
8. Email domain + templates + integração nos triggers.
9. Mercado Pago: secret, server fn de preferência, webhook público.
10. QA responsivo final.

---

## Fora de escopo
- Logo definitivo (placeholder gerado).
- Gerador de chaveamento.

---

## Pós-deploy
Promover primeiro admin no SQL Editor do Supabase do cliente:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<uid-do-usuario>', 'admin');
```
