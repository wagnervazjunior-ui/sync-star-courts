## Plano consolidado

### 1. Migração SQL (uma única)
- Corrigir policy `championships_select_public`: remover `OR has_role(admin)`, deixando apenas `active = true` (público) e mantendo `championships_admin_select_admin` para admins.
- Criar RPC `list_manageable_championships()` (SECURITY DEFINER) retornando campeonatos visíveis ao admin (master → todos; admin comum → criados por ele OU em `championship_admins`).
- Criar RPC `release_expired_registrations()` (SECURITY DEFINER): cancela `pending` com `pix_expires_at < now() - 15min`.
- Ajustar `create_registration`: contagem exclui `pending` claramente expirado (`pix_expires_at < now() - 15min`).
- Índices:
  - `registrations_category_status_idx (category_id, status)`
  - `registrations_pix_expires_idx (pix_expires_at) WHERE status='pending'`
  - `registrations_asaas_payment_id_uniq (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL`
- Habilitar `pg_cron` + `pg_net` e agendar `release_expired_registrations()` a cada 5 min.

### 2. Webhook idempotente
- `src/routes/api/public/asaas-webhook.ts`: nas transições para `cancelled`/`refunded`, só atualizar se status atual não for `confirmed` (evita reverter por evento fora de ordem). Confirmação continua idempotente.

### 3. Cache de páginas públicas
- `src/routes/campeonatos.index.tsx` e `campeonatos.$slug.tsx`: mover fetch para `createServerFn` com `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

### 4. Visibilidade do admin
- `admin.index.tsx`, `admin.campeonatos.index.tsx`: trocar `from("championships").select(...)` por RPC `list_manageable_championships()`.
- Confirmar que `admin.campeonatos.$id.tsx` usa `can_view_championship` (já protegido por RLS).

### 5. UX admin
- `admin.campeonatos.index.tsx`: remover botão "Categorias" do card (subaba já cobre).
- `admin.inscricoes.tsx` e `admin.categorias.$categoryId.tsx`: remover downloads de planilha (ficam só na subaba `planilhas` do campeonato).

### 6. Visual do menu lateral (`admin.tsx`)
- Sidebar: `bg-card` com gradient sutil `from-card to-card/80`, `border-border`.
- NavItem default `text-foreground/80`, hover `bg-accent/60`, ativo mantém `bg-gradient-primary text-primary-foreground shadow-elegant`.
- Adicionar label "Administração" + `Separator` abaixo do logo, e separator antes do bloco e-mail/sair.
- Mobile top-bar: `bg-card`, `border-border`, botões em pills com ícones (`LayoutDashboard`, `Trophy`, `ListChecks`, `Shield`) com mesmo estilo ativo.
- Apenas tokens semânticos de `src/styles.css`.

### Arquivos
- Nova migration SQL
- `supabase--insert` para agendar `pg_cron` (dado de ambiente)
- `src/routes/api/public/asaas-webhook.ts`
- `src/routes/campeonatos.index.tsx`, `src/routes/campeonatos.$slug.tsx`
- `src/routes/admin.tsx`, `admin.index.tsx`, `admin.campeonatos.index.tsx`, `admin.inscricoes.tsx`, `admin.categorias.$categoryId.tsx`

### Garantias
- **Overbooking**: `FOR UPDATE` na categoria + contagem dentro da transação + índice único em `asaas_payment_id` → zero risco mesmo com pagamentos simultâneos.
- **Escala de leitura**: cache edge de 60s nas páginas públicas reduz drasticamente carga no banco.
- **Slots fantasmas**: cron de 5 min libera `pending` expirado.
