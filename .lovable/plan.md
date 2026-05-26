# Portal de Staffs e Reembolsos

## Visão geral do fluxo

1. Admin gera um **link de cadastro** próprio (vinculado ao admin criador, não a um campeonato).
2. Staff abre o link e cadastra **nome, CPF, RG, data de nascimento, chave PIX** (+ contato opcional).
3. Staff faz **login com CPF + data de nascimento** no portal `/staff`.
4. Já logado, escolhe um dos **campeonatos daquele admin** e lança reembolsos (categoria, descrição, valor, data, anexo opcional).
5. Admin acompanha em **dois lugares**: aba "Staff" dentro de cada campeonato e página global "Staffs" no painel admin. Em ambas vê a **chave PIX** do staff e pode marcar como **Pago / Não pago**.

> Observação de segurança: login só com CPF+nascimento é fraco (esses dados vazam). Aceito conforme sua escolha, mas o portal do staff fica isolado — só vê os próprios reembolsos, nunca dados de inscritos/campeonatos.

---

## Estrutura

### 1. Banco (migration)

- `staff_invites` — token único por admin
  - `owner_admin_id`, `token` (slug curto), `active`, `created_at`
- `staffs`
  - `owner_admin_id`, `name`, `cpf` (único por admin), `rg`, `birthdate`, `contact_email`, `contact_phone`
  - `pix_key_type` (enum: `cpf`, `email`, `phone`, `random`), `pix_key`
- `staff_sessions` — token de sessão httpOnly (não usa Supabase Auth, pois não há e-mail/senha)
  - `token`, `staff_id`, `expires_at` (30 dias)
- `staff_reimbursements`
  - `staff_id`, `championship_id`, `category` (enum: `alimentacao`, `transporte`, `passagem`, `gasolina`, `hospedagem`, `outro`), `description`, `amount_cents`, `expense_date`, `receipt_url`, `status` (`pending` | `paid`), `paid_at`, `paid_by`
- Bucket privado `staff-receipts` para anexos (acesso só via server fn)
- Todas as tabelas com RLS **negando acesso direto** — todo I/O passa por server functions (admin via `requireSupabaseAuth`, staff via `requireStaffAuth` próprio)

### 2. Server functions (TanStack)

Arquivo `src/lib/staff.functions.ts` (chamado pelo cliente) + `src/lib/staff.server.ts` (helpers):

**Públicas (sem auth):**
- `getInvite(token)` — valida link
- `registerStaff(token, {name, cpf, rg, birthdate, pix_key_type, pix_key, email?, phone?})`
- `staffLogin(cpf, birthdate)` — verifica, cria registro em `staff_sessions`, seta cookie `staff_session` httpOnly
- `staffLogout()`

**Auth staff (`requireStaffAuth` middleware lê cookie e injeta `staff` no context):**
- `getStaffMe()`
- `updateStaffPix({pix_key_type, pix_key})` — staff pode atualizar a própria chave
- `listStaffChampionships()` — campeonatos do `owner_admin_id` do staff
- `listMyReimbursements()`
- `createReimbursement({championship_id, category, description, amount_cents, expense_date, receipt_file?})`
- `uploadReceiptUrl()` — gera signed upload URL no bucket privado

**Auth admin (`requireSupabaseAuth`):**
- `createOrRotateStaffInvite()` → retorna URL completa
- `listMyStaffs()` — staffs do admin logado (inclui PIX)
- `listStaffReimbursements({championship_id?, status?})` — inclui PIX do staff em cada linha
- `setReimbursementStatus(id, 'paid'|'pending')` — registra `paid_by`/`paid_at`
- `getReceiptSignedUrl(reimbursement_id)` — só admin dono ou staff dono

### 3. Rotas

**Públicas / staff:**
- `/staff/cadastro/$token` — formulário de cadastro (inclui PIX obrigatório)
- `/staff/login` — CPF + data nasc.
- `/_staff/painel` (layout `_staff` com guarda via `getStaffMe`)
  - mostra dados do staff (com PIX) e botão "Editar PIX"
  - lista reembolsos + botão "Novo reembolso"
  - formulário de novo reembolso (select de campeonato, categoria, descrição, valor, data, upload opcional)
  - logout

**Admin (dentro de `/_authenticated`):**
- `/admin/staffs` — página global: botão "Copiar link de cadastro" (gera/rotaciona invite), lista de staffs com chave PIX, tabela de reembolsos com filtro por campeonato/status, coluna PIX + botão "Copiar PIX", toggle Pago/Não pago, visualizar anexo
- `/admin/torneios/$id/staffs` — aba dentro do campeonato: staffs que lançaram reembolsos nele + tabela só desse campeonato com PIX e mesma ação de Pago/Não pago
- Item "Staffs" no menu lateral do admin

### 4. UI

- Formulários com `react-hook-form` + zod (CPF com máscara e validação dígitos, data brasileira, valor em centavos, validação de PIX por tipo: CPF 11 dígitos, e-mail, telefone E.164, aleatória UUID)
- Tabela de reembolsos com badge de status, totalizadores (total / pago / pendente)
- Anexo: input file (imagem ou PDF), preview, upload opcional
- Mantém os tokens do design system existente (`bg-gradient-card`, `Card`, `Button variant="hero"` etc.)

---

## Detalhes técnicos

- **Sessão do staff**: token aleatório (`crypto.randomUUID`) gravado em `staff_sessions`, cookie `staff_session` `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d`. Middleware `requireStaffAuth` lê via `getRequestHeader('cookie')`, busca sessão válida via `supabaseAdmin`, injeta `{ staff }` no context.
- **CPF**: armazenado só com dígitos; índice único `(owner_admin_id, cpf)` para permitir que o mesmo CPF trabalhe para admins diferentes.
- **PIX**: validação por tipo no front e no server. Exibido na tabela do admin com botão de copiar para facilitar o pagamento.
- **Upload de comprovante**: server fn gera signed upload URL via `supabaseAdmin.storage.from('staff-receipts').createSignedUploadUrl(path)`; path = `${owner_admin_id}/${staff_id}/${uuid}.<ext>`. Download por signed URL de 5 min, emitida só para staff dono ou admin dono.
- **Permissão admin**: todas as queries filtram por `owner_admin_id = auth.uid()` (master vê tudo).
- **Link de cadastro**: `https://www.opensync.com.br/staff/cadastro/<token>`. Botão "Rotacionar link" invalida o anterior.

## Não faz parte deste plano

- Aprovação multi-nível de reembolsos (só Pago/Não pago).
- Notificações por e-mail/WhatsApp ao staff quando marcado como pago (posso adicionar depois).
- Exportação CSV/PDF dos reembolsos (posso adicionar depois).
- Integração de pagamento automático via PIX (admin paga manualmente usando a chave exibida).
