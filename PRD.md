# PRD — Open Sync (Star Courts)

**Versão:** 1.0  
**Data:** 2026-05-29  
**Status:** Implementado — documento de referência do estado atual

---

## 1. Visão Geral do Produto

**Open Sync** é uma plataforma web para gestão completa de campeonatos esportivos de duplas (beach tennis, futevôlei, padel e modalidades similares). O sistema cobre todo o ciclo de vida de um evento: criação, inscrições de atletas com pagamento integrado, gestão operacional de staff (árbitros, coordenadores, voluntários) e geração de chaves/brackets de competição.

### 1.1 Objetivos do Produto

- Permitir que organizadores criem e gerenciem campeonatos com múltiplas categorias de forma autônoma.
- Oferecer ao público um fluxo de inscrição online com pagamento via PIX ou cartão de crédito.
- Centralizar o controle financeiro do staff (cachês combinados e reembolsos de despesas) com exportação em Excel.
- Gerenciar brackets de chaveamento com placar e classificação em tempo real.

### 1.2 Público-Alvo

| Ator | Descrição |
|---|---|
| **Organizador (Admin Master)** | Usuário único com acesso total — cria campeonatos, gerencia admins e tem visão global |
| **Administrador** | Usuário com permissões delegadas — gerencia campeonatos específicos, inscrições e staff |
| **Staff** | Árbitro, coordenador, voluntário — acessa painel próprio para lançar reembolsos e cachês |
| **Atleta (público)** | Qualquer pessoa que acessa o site, visualiza campeonatos e realiza inscrições |

---

## 2. Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start (React 19 + TypeScript) — fullstack SSR/SPA |
| Roteamento | TanStack Router (file-based, geração automática de `routeTree.gen.ts`) |
| Estado server | TanStack Query v5 |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação admin | Supabase Auth (email + senha) |
| Autenticação staff | Cookie de sessão próprio (CPF + data de nascimento, sem Supabase Auth) |
| Storage | Supabase Storage (imagens de campeonato, comprovantes de staff) |
| Pagamentos | Asaas (PIX e cartão de crédito) |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 |
| Infra de deploy | Cloudflare Workers (wrangler.jsonc) |
| Runtime de build | Bun |
| Validação | Zod |
| Formulários | React Hook Form + @hookform/resolvers |
| Exportação Excel | ExcelJS |
| E-mail | Resend (via `send-voucher.server.ts`) |
| QR Code | qrcode.react |

---

## 3. Modelo de Dados (Tabelas Principais)

### 3.1 Campeonatos e Categorias

```
championships
  id                      UUID PK
  name                    TEXT
  slug                    TEXT UNIQUE
  description             TEXT
  start_date              DATE
  end_date                DATE
  location                TEXT
  location_url            TEXT (link Google Maps)
  cover_image_url         TEXT
  active                  BOOLEAN
  regulations             TEXT
  policies                TEXT
  cancellation_policy     TEXT
  shirt_size_chart_urls   TEXT[] (múltiplas imagens da tabela de medidas)
  shirt_size_guarantee_until DATE
  uniform_models          TEXT[] (ex.: ["Amador", "Profissional"])
  created_by              UUID (FK auth.users)
  created_at              TIMESTAMPTZ

categories
  id                      UUID PK
  championship_id         UUID FK championships
  name                    TEXT
  description             TEXT
  prize                   TEXT
  gender                  TEXT ('male' | 'female' | 'mixed')
  max_slots               INTEGER
  price_cents             INTEGER
  active                  BOOLEAN
  uniform_model           TEXT
  age_rule_mode           TEXT ('none' | 'individual_min' | 'sum_min')
  age_min                 INTEGER
  created_at              TIMESTAMPTZ
```

### 3.2 Inscrições e Pagamento

```
registrations
  id                      UUID PK
  category_id             UUID FK categories
  voucher_code            TEXT UNIQUE
  status                  TEXT ('pending' | 'confirmed' | 'cancelled' | 'processing')
  team_name               TEXT
  contact_email           TEXT
  contact_phone           TEXT
  athlete1_name           TEXT
  athlete1_shirt_size     TEXT
  athlete1_shorts_size    TEXT
  athlete1_birthdate      DATE
  athlete2_name           TEXT
  athlete2_shirt_size     TEXT
  athlete2_shorts_size    TEXT
  athlete2_birthdate      DATE
  terms_accepted          BOOLEAN
  amount_cents            INTEGER
  payer_cpf               TEXT
  pix_qr_code             TEXT
  pix_qr_code_base64      TEXT
  pix_expires_at          TIMESTAMPTZ
  asaas_charge_id         TEXT
  created_at              TIMESTAMPTZ
```

### 3.3 Autenticação e Permissões Admin

```
user_roles
  user_id   UUID FK auth.users
  role      app_role ('master' | 'admin')
  PK (user_id, role)

admin_permissions
  user_id                  UUID FK auth.users PK
  can_create_championships BOOLEAN
  updated_at               TIMESTAMPTZ

championship_admins
  championship_id  UUID FK championships
  user_id          UUID FK auth.users
  granted_by       UUID
  created_at       TIMESTAMPTZ
  PK (championship_id, user_id)
```

### 3.4 Staff

```
staffs
  id              UUID PK
  owner_admin_id  UUID FK auth.users
  name            TEXT
  cpf             TEXT
  rg              TEXT
  birthdate       DATE
  contact_email   TEXT
  contact_phone   TEXT
  pix_key_type    TEXT ('cpf' | 'email' | 'phone' | 'random')
  pix_key         TEXT
  category_id     UUID FK staff_categories (nullable)
  created_at      TIMESTAMPTZ

staff_categories
  id              UUID PK
  owner_admin_id  UUID FK auth.users
  name            TEXT
  created_at      TIMESTAMPTZ

staff_championships
  staff_id         UUID FK staffs
  championship_id  UUID FK championships
  UNIQUE (staff_id, championship_id)

staff_sessions
  token       TEXT PK
  staff_id    UUID FK staffs
  expires_at  TIMESTAMPTZ

staff_invites
  id                 UUID PK
  owner_admin_id     UUID FK auth.users
  championship_id    UUID FK championships
  token              TEXT UNIQUE
  active             BOOLEAN
  created_at         TIMESTAMPTZ

staff_reimbursements
  id               UUID PK
  staff_id         UUID FK staffs
  championship_id  UUID FK championships
  category         TEXT ('alimentacao' | 'transporte' | 'passagem' | 'gasolina' | 'hospedagem' | 'outro')
  description      TEXT
  amount_cents     INTEGER
  expense_date     DATE
  receipt_path     TEXT (Storage path)
  status           TEXT ('pending' | 'paid')
  paid_at          TIMESTAMPTZ
  paid_by          UUID
  created_at       TIMESTAMPTZ

staff_fees
  id               UUID PK
  staff_id         UUID FK staffs
  championship_id  UUID FK championships
  amount_cents     INTEGER
  description      TEXT
  receipt_path     TEXT (Storage path)
  status           TEXT ('pending' | 'paid')
  paid_at          TIMESTAMPTZ
  paid_by          UUID
  created_by_role  TEXT ('staff' | 'admin')
  created_by       UUID
  UNIQUE (staff_id, championship_id)
```

### 3.5 Chaves / Brackets

```
brackets
  id               UUID PK
  name             TEXT
  championship_id  UUID FK championships
  category_id      UUID FK categories
  status           TEXT ('active' | 'finished')
  format           TEXT
  created_at       TIMESTAMPTZ

bracket_teams
  id         UUID PK
  bracket_id UUID FK brackets
  name       TEXT
  seed       INTEGER
  position   INTEGER

bracket_matches
  id         UUID PK
  bracket_id UUID FK brackets
  round      INTEGER
  match_no   INTEGER
  team1_id   UUID FK bracket_teams
  team2_id   UUID FK bracket_teams
  score1     INTEGER
  score2     INTEGER
  winner_id  UUID FK bracket_teams
  played_at  TIMESTAMPTZ
```

---

## 4. Funções RPC (Supabase)

| Função | Descrição |
|---|---|
| `list_manageable_championships` | Lista campeonatos visíveis ao usuário logado (master vê todos, admin vê criados por ele ou delegados) |
| `can_view_championship(_user_id, _championship_id)` | Retorna boolean — usado como guard antes de operações sensíveis |
| `dashboard_stats(_championship_id?)` | Retorna total/pending/confirmed/cancelled/revenue para o dashboard |
| `get_category_availability(_category_id)` | Vagas restantes na categoria (max_slots − inscrições ativas) |
| `create_registration(payload)` | Cria inscrição validando disponibilidade de vagas e regra de idade; retorna voucher_code |
| `confirm_registration(_id)` | Confirma inscrição manualmente (admin) |
| `cancel_registration(_id)` | Cancela inscrição (admin) |
| `get_registration_by_voucher(_code)` | Retorna dados completos da inscrição para a página de pagamento |
| `list_championship_admins(_championship_id)` | Lista admins com acesso ao campeonato (uso: aba Permissões) |
| `grant_championship_admin(_championship_id, _email)` | Concede acesso de admin a um campeonato por e-mail |
| `revoke_championship_admin(_championship_id, _user_id)` | Revoga acesso ao campeonato |

---

## 5. Funcionalidades por Área

---

### 5.1 Área Pública

#### 5.1.1 Homepage (`/`)
- Landing page com acesso à listagem de campeonatos e login de admin.

#### 5.1.2 Listagem de Campeonatos (`/campeonatos`)
- Exibe todos os campeonatos com `active = true`.
- Cards com nome, datas, local e imagem de capa.
- Link para página de detalhe de cada campeonato.

#### 5.1.3 Detalhe do Campeonato (`/campeonatos/:slug`)
- Imagem de capa em banner full-width com gradiente.
- Nome, datas, local com link para Google Maps.
- Descrição completa.
- Lista de categorias ativas com preço e disponibilidade de vagas.
  - Botão "Inscrever dupla" (desabilitado se categoria esgotada).
- Seção "Local do evento" com botão "Abrir no Google Maps".
- Acordeão com textos legais: Regulamento, Políticas do evento, Política de cancelamento e reembolso.
- Cache público de resposta (HTTP headers via `setPublicCacheHeaders`).

#### 5.1.4 Formulário de Inscrição (`/inscricao/:categoryId`)
- Dados da dupla: e-mail, WhatsApp (com máscara), nome da dupla.
- Aviso de prazo de garantia do tamanho do uniforme (exibido automaticamente se configurado).
- Dois blocos de atleta:
  - Nome completo.
  - Data de nascimento (exibida somente se a categoria tem regra de idade).
  - Validação de idade no cliente (individual ou soma da dupla) com feedback de erro claro.
  - Tamanhos de camiseta e shorts (P, M, G, GG, XG).
  - Link para tabela de medidas do uniforme (dialog com imagens do campeonato).
- Termo de Responsabilidade e Uso de Imagem:
  - Exibe regulamento do campeonato em caixa rolável.
  - Exibe premiação específica da categoria.
  - Checkbox obrigatório de aceite.
- Validação com Zod + React Hook Form.
- Após envio bem-sucedido, redireciona para `/sucesso/:voucher`.

#### 5.1.5 Página de Pagamento / Sucesso (`/sucesso/:voucher`)
- Exibe status em tempo real (polling automático a cada 5s enquanto pendente).
- **Estado pendente:**
  - Abas PIX e Cartão de Crédito.
  - **PIX:** coleta CPF do pagador, gera cobrança Asaas, exibe QR Code (imagem base64) e código copia-e-cola com botão copiar.
  - Auto-geração do PIX se CPF já foi salvo anteriormente.
  - Botão "Simular pagamento (sandbox)" para testes.
  - **Cartão:** formulário de cartão de crédito via `CardPaymentForm` (componente dedicado).
- **Estado confirmado:**
  - Ícone de check verde.
  - Exibe QR Code do voucher (para check-in no evento).
  - Botão "Acessar meu voucher" → `/voucher/:id`.
  - Botão "Baixar voucher (PDF)" → `/voucher/:id?print=1`.
  - Botão "Reenviar e-mail de confirmação".
  - Botão "Enviar voucher pelo WhatsApp" (deeplink `wa.me` com mensagem formatada).
- **Estado em análise (cartão):** ícone de relógio.

#### 5.1.6 Voucher (`/voucher/:id`)
- Página de voucher para o atleta guardar e apresentar na entrada.
- Exibe nome do campeonato, categoria, dupla, atletas, valor, status, QR Code.
- Modo impressão/PDF (`?print=1`).

#### 5.1.7 Busca de Voucher (`/voucher`)
- Campo para o atleta buscar sua inscrição pelo código do voucher.

---

### 5.2 Área Admin

Acesso restrito a usuários com role `admin` ou `master`. Protegido por guard no layout (`/admin`).

#### 5.2.1 Login Admin (`/login`)
- Autenticação via Supabase Auth (e-mail + senha).
- Redireciona para `/admin` após login.

#### 5.2.2 Layout Admin (`/admin`)
- Sidebar fixa em desktop com navegação: Dashboard, Campeonatos, Inscrições, Staffs, Chaves, Administradores (master only).
- Navbar horizontal em mobile (chips com ícone + label).
- Exibe e-mail do usuário logado.
- Botão de logout.

#### 5.2.3 Dashboard Global (`/admin`)
- Seletor de campeonato (ou "Todos").
- Cards de métricas via RPC `dashboard_stats`:
  - Total de inscrições.
  - Pendentes / Confirmadas / Canceladas.
  - Receita confirmada (R$).
  - Campeonatos ativos.

#### 5.2.4 Listagem de Campeonatos (`/admin/campeonatos`)
- Lista campeonatos gerenciáveis pelo usuário logado.
- Badge de status (Ativo / Inativo).
- Slug/URL do campeonato.
- Local do evento.
- Botão excluir (com confirmação).
- Botão "Novo campeonato" (visível somente a admins com `can_create_championships = true`).
- Dialog de criação/edição de campeonato com todos os campos (ver seção 5.2.5).

#### 5.2.5 Detalhe do Campeonato (`/admin/campeonatos/:id`)

Página com 7 abas (+ aba Permissões para master):

**Aba Configurações**
- Edição in-line de todos os campos do campeonato:
  - Nome, slug (auto-gerado a partir do nome se vazio), descrição.
  - Datas de início e fim.
  - Local e link Google Maps.
  - Imagem de capa (upload para Storage `championship-covers`).
  - Tabela de medidas do uniforme (múltiplas imagens; upload e remoção individual).
  - Data limite de garantia do tamanho do uniforme (exibida no form de inscrição).
  - Modelos de uniforme (lista de strings; cada categoria seleciona um modelo).
  - Regulamento, Políticas do evento, Política de cancelamento e reembolso.
  - Toggle Ativo/Inativo.
- Alerta amarelo quando campeonato está inativo.
- Botão "Ver página pública".

**Aba Dashboard**
- Métricas específicas do campeonato:
  - Categorias ativas / total.
  - Inscrições confirmadas, pendentes, canceladas.
  - Receita confirmada.
  - Percentual de ocupação (vagas ocupadas / vagas totais).
  - Datas de início/fim e data de garantia de tamanho.

**Aba Categorias**
- Lista de categorias com: nome, status (Ativa/Inativa), gênero, modelo de uniforme, vagas ocupadas/total e preço.
- Alerta se campeonato ativo mas nenhuma categoria ativa.
- Dialog de criação/edição de categoria com:
  - Nome, descrição, premiação.
  - Gênero (Masculina / Feminina / Mista).
  - Modelo de uniforme (selecionado a partir dos modelos do campeonato).
  - Vagas máximas e preço em R$.
  - Regra de idade (nenhuma / idade mínima individual / soma mínima da dupla) + valor mínimo.
  - Toggle Ativa/Inativa.
- Botão "Inscrições" leva para `/admin/categorias/:categoryId`.
- Botão editar e excluir por categoria.

**Aba Inscrições**
- Filtros por categoria, status (Todos/Pendentes/Confirmadas/Canceladas) e busca por texto (voucher, dupla, e-mail).
- Contador de resultados.
- Cards de inscrição com:
  - Código do voucher, status (badge colorido), categoria.
  - Nome da dupla, telefone.
  - Atleta 1 e Atleta 2: nome, tamanho de camisa e shorts.
  - E-mail e data de inscrição.
- Ações: confirmar manualmente, cancelar.

**Aba Planilhas**
- Exportação de planilha de uniformes (Excel): todos os tamanhos de camiseta e shorts das inscrições confirmadas, agrupados por categoria. Gerado via `generateUniformWorkbook`.
- Exportação de lista da portaria (Excel): duplas confirmadas para conferência na entrada. Gerado via `generateGateListWorkbook`.

**Aba Staff**
- Filtro por status (Todos / Pendentes / Pagos).
- Botão "Baixar Excel" — exporta financeiro consolidado do staff para este campeonato.
- **Cachês combinados:** tabela com staff, descrição, PIX (copiável), valor, status, e ações (marcar pago/desfazer, ver anexo).
- **Reembolsos:** tabela com staff, categoria, descrição, data, PIX (copiável), valor, status, e ações (marcar pago/desfazer, ver comprovante).
- Totalizadores: Total / Pago / Pendente (para cachês e reembolsos separados).

**Aba Chaves**
- Lista de brackets do campeonato (cards com nome e status Live/Final).
- Botão "Nova chave" → `CreateBracketDialog`.
- Links para `/admin/chaves/:bracketId`.

**Aba Permissões** (somente master)
- Lista de admins com acesso a este campeonato (e-mail, data de concessão).
- Campo para conceder acesso por e-mail.
- Botão para revogar acesso de cada admin.
- Nota: master e criador do campeonato sempre têm acesso.

#### 5.2.6 Detalhe de Categoria (`/admin/categorias/:categoryId`)
- Listagem detalhada de inscrições da categoria.
- Filtros e ações de confirmação/cancelamento individuais.

#### 5.2.7 Inscrições Global (`/admin/inscricoes`)
- Visão consolidada de todas as inscrições dos campeonatos gerenciáveis.
- Filtros por campeonato, categoria, status, busca textual.

#### 5.2.8 Gestão de Staffs (`/admin/staffs`)

**Seção: Categorias de Staff**
- Admin cria categorias para classificar staffs (ex.: Árbitro, Coordenador, Voluntário).
- As categorias ficam disponíveis no formulário de cadastro do staff.
- Criação inline (input + botão, aceita Enter).
- Listagem em chips com botão de exclusão.

**Seção: Links de Cadastro por Campeonato**
- Para cada campeonato gerenciável, exibe o link de convite ativo ou opção de gerar.
- Gerar/rotacionar link (desativa o anterior, cria novo token).
- Botão "Copiar link".

**Seção: Staffs Cadastrados / Deste Torneio**
- Seletor de campeonato (filtro principal).
  - Sem filtro: lista todos os staffs do admin.
  - Com filtro: lista staffs do campeonato selecionado.
- Busca por nome, CPF ou e-mail.
- Tabela com: nome (link para detalhe), CPF, contato, chave PIX (copiável).
- Por linha: botão de vincular a outro torneio (`LinkToChampionshipDialog`), botão desvincular do torneio atual (com confirmação), botão lançar cachê (`AdminFeeDialog`), botão excluir staff (com confirmação; remove sessões, reembolsos, cachês e vínculos).
- **Seção "Disponíveis para vincular"** (visível quando campeonato filtrado):
  - Staffs do admin ainda não vinculados ao campeonato selecionado.
  - Botão "Vincular" em cada card.
  - Erro com mensagem clara caso staff possua registros financeiros ao tentar desvincular.

**Seção: Filtros e Exportação**
- Filtro por campeonato e status financeiro.
- Botão "Baixar Excel" — exporta financeiro de todo o staff (ou por campeonato).

**Seção: Cachês Combinados**
- Tabela com staff, campeonato, descrição, PIX, valor, status.
- Ações: marcar pago / desfazer, ver anexo, excluir.
- Totalizadores.

**Seção: Reembolsos**
- Tabela com staff, campeonato, categoria da despesa, descrição, data, PIX, valor, status.
- Ações: marcar pago / desfazer, ver comprovante, excluir.
- Totalizadores.

#### 5.2.9 Detalhe de Staff (`/admin/staffs/:staffId`)
- Card com dados do staff: nome, categoria (badge), CPF, contato, chave PIX.
- 4 cards de métricas: Reembolsos total, Cachês total, Total geral, A pagar.
- Filtros por campeonato e status.
- Tabelas separadas de Reembolsos e Cachês do staff (com ações de status e exclusão).

#### 5.2.10 Gestão de Chaves (`/admin/chaves`)
- Listagem global de brackets com campeonato e categoria.
- Link para detalhe de cada chave.
- `CreateBracketDialog` para criar nova chave.

#### 5.2.11 Detalhe da Chave (`/admin/chaves/:bracketId`)
- Visualização do bracket com cards de partidas (`MatchCard`).
- Edição de equipes (`EditTeamDialog`).
- Registro de resultados de partidas (`MatchResultDialog`).
- Mover equipes de posição (`MoveTeamDialog`).
- Aba de classificação (`StandingsTab`).
- Visualização completa do bracket (`BracketView`).

#### 5.2.12 Gestão de Administradores (`/admin/administradores`) — master only
- Lista de todos os admins do sistema.
- Criar novo admin (por e-mail — o usuário precisa existir em `auth.users`).
- Gerenciar permissão `can_create_championships` por admin.
- Revogar role de admin.

---

### 5.3 Área Staff

Sistema de autenticação próprio, independente do Supabase Auth. Autenticação por cookie de sessão (`staff-session`).

#### 5.3.1 Cadastro de Staff (`/staff/cadastro/:token`)
- Token de convite gerado pelo admin vinculado a um campeonato.
- Validação do token (ativo e válido).
- Campos: nome completo, CPF (com validação de dígito verificador), RG, data de nascimento.
- Contato: e-mail e telefone (opcionais).
- Chave PIX: tipo (CPF, e-mail, telefone, aleatória) + valor (validação por tipo).
- Seleção de categoria de staff (ex.: Árbitro) — exibe apenas categorias do admin dono do convite.
- Verificação de CPF duplicado por admin (evita recadastro).
- Após cadastro, cria sessão automaticamente e redireciona para o painel.
- Se staff já existe (mesmo admin, mesmo CPF), exibe formulário de login.

#### 5.3.2 Login de Staff (`/staff/login`)
- CPF + data de nascimento.
- Token de convite opcional (na URL) — se fornecido e válido, vincula o staff ao campeonato correspondente.
- Cria sessão com cookie HTTPOnly.

#### 5.3.3 Painel do Staff (`/staff/painel`)
- Header com logo, nome do staff e botão sair.
- **Card de perfil:** nome, CPF, tipo PIX e chave. Botão "Editar PIX" (`EditPixDialog`).
- **Cards de totais:** Total lançado / Pago / Pendente (de reembolsos).
- **Meus Reembolsos:**
  - Lista com badge de categoria, status, campeonato, descrição, data da despesa, valor e botão para ver comprovante.
  - Dialog "Novo reembolso": campeonato, categoria (alimentação/transporte/passagem/gasolina/hospedagem/outro), valor, data da despesa, descrição e upload de comprovante (imagem ou PDF via Signed Upload URL do Storage).
- **Cachês Combinados:**
  - Lista com status, campeonato, descrição, valor e botão para ver anexo.
  - Dialog "Registrar cachê": campeonato, valor combinado, descrição e upload de anexo.
  - Proteção: se cachê já foi marcado como pago pelo admin, edição é bloqueada com mensagem clara.

---

## 6. Integrações Externas

### 6.1 Asaas (Gateway de Pagamento)

- **PIX:** criação de cobrança via `POST /payments` com expiração configurável. Retorna QR Code (imagem base64 + payload copia-e-cola). Polling automático de status via webhook (`/api/public/asaas-webhook`).
- **Cartão de crédito:** cobrança via tokenização do cartão no formulário `CardPaymentForm`.
- **Simulação sandbox:** botão de simulação de pagamento para testes em ambiente de desenvolvimento.
- **CPF do pagador:** necessário para geração de cobrança PIX; coletado na página de sucesso se não presente no cadastro.

### 6.2 Supabase Storage

Dois buckets:
- `championship-covers`: imagens de capa de campeonatos e tabelas de medidas de uniforme (URLs públicas).
- `staff-receipts`: comprovantes de reembolso e anexos de cachês do staff (URLs assinadas com TTL de 300s).

### 6.3 E-mail (Resend)

- Envio de e-mail de confirmação com voucher após pagamento confirmado.
- Reenvio manual pelo atleta na página de sucesso.
- Template em `src/lib/email-templates/voucher-confirmed.ts`.

---

## 7. Modelo de Segurança e Autorização

### 7.1 Roles de Admin

| Role | Capacidades |
|---|---|
| `master` | Único. Acesso total. Gerencia admins, cria campeonatos, vê todos os campeonatos, gerencia permissões por campeonato. |
| `admin` | Acesso aos campeonatos que criou + campeonatos que lhe foram delegados via `championship_admins`. Permissão `can_create_championships` controlada individualmente pelo master. |

### 7.2 Guard de Campeonato

A função RPC `can_view_championship` é chamada antes de qualquer operação sensível (criar/rotacionar convite de staff, vincular staff, etc.). Retorna `true` se o usuário é master, criador do campeonato ou está em `championship_admins`.

### 7.3 Autenticação de Staff

- Cookie de sessão HTTPOnly (`staff-session`) com expiração.
- Middleware `requireStaffAuth` valida o token em `staff_sessions` antes de qualquer ServerFn autenticada.
- Staff só pode acessar reembolsos e cachês vinculados ao seu próprio `staff_id`.
- Staff não pode editar cachê já marcado como pago pelo admin (`FEE_LOCKED_PAID`).
- Admin só pode acessar staffs com `owner_admin_id = userId`.
- Desvincular staff de campeonato é bloqueado se houver registros financeiros ativos (`HAS_FINANCIAL_RECORDS`).

### 7.4 Validações de Negócio

- Inscrição: vagas são contadas com lock no banco via `create_registration` RPC (evita race condition).
- Regra de idade validada no cliente E no servidor (RPC).
- Termo de responsabilidade: `terms_accepted = true` obrigatório na inscrição.
- CPF de staff: validado por algoritmo de dígito verificador.
- Chave PIX: validada por tipo (CPF, e-mail, telefone, aleatória) com regras específicas para cada formato.

---

## 8. Exportações em Excel

### 8.1 Planilha de Uniformes

- Gerada por `generateUniformWorkbook`.
- Uma aba por categoria com inscrições confirmadas.
- Colunas: dupla, atleta 1 e 2 com tamanhos de camiseta e shorts.

### 8.2 Lista da Portaria

- Gerada por `generateGateListWorkbook`.
- Lista de duplas confirmadas agrupadas por categoria.
- Usada para conferência de acesso no dia do evento.

### 8.3 Planilha Financeira de Staff

- Gerada por `exportStaffFinanceXlsx`.
- Uma aba "Financeiro" consolidada com todas as colunas: staff, CPF, tipo PIX, chave PIX, campeonatos, reembolsos pagos, reembolsos pendentes, cachê, status cachê, total a pagar, total geral.
- Linha de totais com fórmulas SUM.
- Formatação monetária em R$.
- Filtrável por campeonato ou visão global.
- Disponível em dois pontos: `/admin/staffs` (global) e aba Staff de cada campeonato.

---

## 9. Mapa de Rotas

### Rotas Públicas

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `index.tsx` | Landing page |
| `/campeonatos` | `campeonatos.index.tsx` | Listagem de campeonatos |
| `/campeonatos/:slug` | `campeonatos.$slug.tsx` | Detalhe do campeonato |
| `/inscricao/:categoryId` | `inscricao.$categoryId.tsx` | Formulário de inscrição |
| `/sucesso/:voucher` | `sucesso.$voucher.tsx` | Pagamento e confirmação |
| `/voucher` | `voucher.index.tsx` | Busca de voucher |
| `/voucher/:id` | `voucher.$id.tsx` | Visualização do voucher |
| `/api/public/asaas-webhook` | `api/public/asaas-webhook.ts` | Webhook de pagamento Asaas |

### Rotas Admin

| Rota | Descrição |
|---|---|
| `/login` | Login de administrador |
| `/admin` | Dashboard global (layout com sidebar) |
| `/admin/campeonatos` | Listagem de campeonatos |
| `/admin/campeonatos/:id` | Detalhe do campeonato (7 abas) |
| `/admin/categorias/:categoryId` | Inscrições de uma categoria |
| `/admin/inscricoes` | Inscrições global |
| `/admin/staffs` | Gestão de staffs |
| `/admin/staffs/:staffId` | Detalhe de um staff |
| `/admin/chaves` | Listagem de brackets |
| `/admin/chaves/:bracketId` | Detalhe/edição de bracket |
| `/admin/administradores` | Gestão de admins (master only) |

### Rotas Staff

| Rota | Descrição |
|---|---|
| `/staff/login` | Login de staff (CPF + nascimento) |
| `/staff/cadastro/:token` | Cadastro via convite |
| `/staff/painel` | Painel pessoal do staff |

---

## 10. ServerFunctions (TanStack Start)

Todas em `src/lib/`:

### `staff.functions.ts`

| Função | Auth | Descrição |
|---|---|---|
| `getInvite` | pública | Valida token de convite |
| `registerStaff` | pública | Cadastra staff e cria sessão |
| `staffLogin` | pública | Login + criação de sessão |
| `staffLogout` | staff | Invalida sessão |
| `getStaffMe` | staff (opcional) | Retorna dados do staff logado |
| `updateStaffPix` | staff | Atualiza chave PIX |
| `listStaffChampionships` | staff | Lista campeonatos do staff |
| `listMyReimbursements` | staff | Lista reembolsos do staff |
| `createReimbursement` | staff | Cria reembolso com upload opcional |
| `createReceiptUploadUrl` | staff | Gera Signed Upload URL para comprovante |
| `listMyFees` | staff | Lista cachês do staff |
| `upsertMyFee` | staff | Cria/atualiza cachê próprio |
| `getMyFeeReceiptSignedUrl` | staff | URL assinada do anexo de cachê |
| `getMyReceiptSignedUrl` | staff | URL assinada do comprovante de reembolso |
| `listManageableChampionships` | admin | Lista campeonatos gerenciáveis |
| `createOrRotateStaffInviteForChampionship` | admin | Gera/rotaciona link de convite |
| `listStaffInvites` | admin | Lista convites ativos |
| `listMyStaffs` | admin | Lista staffs com filtros (`championship_id`, `not_in_championship_id`) |
| `linkStaffToChampionship` | admin | Vincula staff a campeonato |
| `unlinkStaffFromChampionship` | admin | Desvincula (bloqueia se há registros financeiros) |
| `adminGetStaff` | admin | Dados completos de um staff |
| `adminListReimbursements` | admin | Lista reembolsos com filtros |
| `setReimbursementStatus` | admin | Marca pago/pendente |
| `getReceiptSignedUrl` | admin | URL assinada de comprovante |
| `adminListFees` | admin | Lista cachês com filtros |
| `adminUpsertFee` | admin | Cria/atualiza cachê de staff (auto-vincula) |
| `setFeeStatus` | admin | Marca cachê pago/pendente |
| `getFeeReceiptSignedUrl` | admin | URL assinada do anexo de cachê |
| `createAdminReceiptUploadUrl` | admin | Signed Upload URL para admin |
| `exportStaffFinanceXlsx` | admin | Gera planilha Excel financeira |
| `listStaffCategoriesByToken` | pública | Categorias de staff via token de convite |
| `listStaffCategories` | admin | Lista categorias de staff do admin |
| `createStaffCategory` | admin | Cria categoria de staff |
| `deleteStaffCategory` | admin | Exclui categoria de staff |
| `adminDeleteStaff` | admin | Exclui staff e todos os dados dependentes |
| `adminDeleteReimbursement` | admin | Exclui reembolso |
| `adminDeleteFee` | admin | Exclui cachê |

### `payments.functions.ts`
| Função | Auth | Descrição |
|---|---|---|
| `createPixCharge` | pública | Cria cobrança PIX no Asaas |
| `simulatePayment` | pública | Simula confirmação de pagamento (sandbox) |

### `voucher.functions.ts`
| Função | Auth | Descrição |
|---|---|---|
| `resendVoucherEmail` | pública | Reenvia e-mail de confirmação |

### `brackets.functions.ts`
| Função | Auth | Descrição |
|---|---|---|
| `listBrackets` | admin | Lista brackets (por campeonato opcional) |
| *(outras)* | admin | Criar, editar equipes, registrar resultados |

### `public-cache.functions.ts`
| Função | Descrição |
|---|---|
| `setPublicCacheHeaders` | Define headers de cache HTTP para rotas públicas |

---

## 11. Componentes de Destaque

| Componente | Localização | Descrição |
|---|---|---|
| `PublicHeader` | `src/components/PublicHeader.tsx` | Header das páginas públicas com logo e navegação |
| `Logo` | `src/components/Logo.tsx` | Logotipo do sistema |
| `CardPaymentForm` | `src/components/CardPaymentForm.tsx` | Formulário de pagamento com cartão de crédito (Asaas) |
| `BracketView` | `src/components/brackets/BracketView.tsx` | Visualização do bracket completo |
| `CreateBracketDialog` | `src/components/brackets/CreateBracketDialog.tsx` | Criação de nova chave |
| `EditTeamDialog` | `src/components/brackets/EditTeamDialog.tsx` | Edição de equipe |
| `MatchCard` | `src/components/brackets/MatchCard.tsx` | Card de partida no bracket |
| `MatchResultDialog` | `src/components/brackets/MatchResultDialog.tsx` | Registro de resultado |
| `MoveTeamDialog` | `src/components/brackets/MoveTeamDialog.tsx` | Movimentação de equipe |
| `StandingsTab` | `src/components/brackets/StandingsTab.tsx` | Classificação do bracket |

---

## 12. Histórico de Migrações (Supabase)

| Data | Descrição |
|---|---|
| 2026-05-08 | Schema inicial: championships, categories, registrations, user_roles, admin_permissions |
| 2026-05-08 | RPC create_registration, validação de vagas e idade |
| 2026-05-08 | Webhook Asaas, pagamento PIX |
| 2026-05-08 | Slugs e páginas públicas |
| 2026-05-09 | championship_admins, grant/revoke RPC |
| 2026-05-09 | dashboard_stats RPC |
| 2026-05-10 | staff, staff_sessions, staff_invites, staff_championships |
| 2026-05-10 | staff_reimbursements, staff_fees |
| 2026-05-11 | Melhorias no modelo de pagamento (cartão) |
| 2026-05-11 | Brackets: brackets, bracket_teams, bracket_matches |
| 2026-05-12 | Ajustes de RLS e índices |
| 2026-05-26 | Modelo de uniforme por categoria; shirt_size_chart_urls; prize na categoria |
| 2026-05-26 | age_rule_mode / age_min nas categorias |
| 2026-05-26 | Regras de cancelamento e políticas no campeonato |
| 2026-05-27 | Melhorias no sistema de staff |
| 2026-05-27 | Exportação Excel de uniformes e portaria |
| 2026-05-28 | Troca do admin master para `estacao.open23@gmail.com` |
| 2026-05-28 | `staff_categories`: categorias de staff com seleção no cadastro |

---

## 13. Decisões Técnicas Relevantes

1. **Autenticação de staff separada:** O staff não usa Supabase Auth para evitar criar contas na tabela `auth.users` para cada árbitro/voluntário. A autenticação é por CPF + data de nascimento com cookie HTTPOnly de sessão gerenciado pelo servidor.

2. **Pagamento sem conta de usuário:** O fluxo de inscrição é completamente sem login. O atleta acessa seu voucher via URL com o código e pode gerenciar o pagamento sem criar conta.

3. **Server Functions para operações sensíveis:** Operações de pagamento, criação de URLs assinadas de Storage e qualquer acesso a dados de staff usam `createServerFn` (executado no servidor via Cloudflare Workers), nunca no cliente diretamente.

4. **Vinculação muitos-para-muitos de staff:** Um staff pode trabalhar em múltiplos campeonatos do mesmo admin via `staff_championships`. Desvincular é bloqueado se há registros financeiros para preservar histórico.

5. **Geração de Excel no servidor:** A exportação de planilhas usa ExcelJS no servidor (dentro de ServerFn) para não vazar dados para o cliente. O resultado é retornado como base64 e o cliente faz o download via Blob.

6. **Cache HTTP em rotas públicas:** A listagem e detalhe de campeonatos usam `setPublicCacheHeaders` para aproveitar cache do edge (Cloudflare), reduzindo latência para visitantes.

7. **Polling de pagamento:** A página de sucesso faz polling a cada 5 segundos via TanStack Query `refetchInterval` enquanto o status for pendente, parando automaticamente ao confirmar ou cancelar.
