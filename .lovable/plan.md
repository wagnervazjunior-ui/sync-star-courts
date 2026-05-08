## Objetivo

Expandir o cadastro de campeonatos com informações institucionais (local com Google Maps, políticas, regulamento), tabela de medidas do uniforme (upload de imagens) e data limite de garantia do tamanho. As informações institucionais aparecem na página pública do campeonato; a tabela de medidas e o aviso de garantia aparecem **apenas** na página de preenchimento de dados da inscrição.

---

## 1. Banco de dados (migration)

Adicionar à tabela `championships`:
- `location_url` (text) — link do Google Maps do local.
- `policies` (text) — políticas gerais do evento.
- `cancellation_policy` (text) — política de cancelamento e reembolso.
- `regulations` (text) — regulamento do campeonato.
- `shirt_size_guarantee_until` (timestamptz) — data limite para garantir o tamanho do uniforme.
- `shirt_size_chart_urls` (text[]) — URLs das imagens da tabela de medidas (1 ou mais).

Storage: reutilizar o bucket público `championship-covers` em subpasta `size-charts/`. Sem nova migration de bucket.

---

## 2. Admin — formulário de campeonato (`admin.campeonatos.index.tsx`)

No `ChampionshipDialog`, adicionar (organizado em seções dentro do mesmo dialog):

**Local**
- Campo "Local" (já existe).
- Novo "Link Google Maps" (`location_url`).

**Uniforme**
- Upload múltiplo de imagens (`shirt_size_chart_urls`) com preview em grid e botão para remover cada uma.
- Date picker "Data limite para garantia do tamanho" (`shirt_size_guarantee_until`).

**Textos legais** (Textareas)
- Regulamento (`regulations`)
- Políticas do evento (`policies`)
- Política de cancelamento e reembolso (`cancellation_policy`)

Campos opcionais; admin preenche por etapas.

---

## 3. Página pública do campeonato (`campeonatos.$slug.tsx`)

Acrescentar seções abaixo das categorias:
- **Local**: nome + botão "Abrir no Google Maps" (se `location_url` setado).
- **Regulamento / Políticas / Cancelamento**: accordions (`@/components/ui/accordion`).

Não exibir aqui a tabela de medidas nem o aviso de garantia.

---

## 4. Página de inscrição (`inscricao.$categoryId.tsx`)

Buscar também os campos novos do campeonato no query da categoria.

- **Link "Ver tabela de medidas"** próximo aos selects de tamanho — abre Dialog com galeria das imagens de `shirt_size_chart_urls` (clicáveis para ampliar). Só renderiza se houver imagens.
- **Aviso de garantia de tamanho** (`Alert` amarelo) no topo do bloco de uniforme:
  - Futuro: "Garantimos a troca do tamanho para inscrições feitas até DD/MM/AAAA. Após essa data, o tamanho está sujeito à disponibilidade."
  - Passado: "O prazo de garantia de tamanho expirou em DD/MM/AAAA. Tamanho sujeito à disponibilidade."
  - Não renderiza se vazio.

---

## Detalhes técnicos

- Migration única adicionando todas as colunas em `public.championships`.
- Tipos do Supabase regenerados automaticamente.
- Upload múltiplo: `<input type="file" multiple>` iterando `supabase.storage.from('championship-covers').upload('size-charts/{uuid}.{ext}', ...)` e acumulando URLs em `shirt_size_chart_urls`.
- Date picker: Shadcn (Popover + Calendar com `pointer-events-auto`).
- Datas formatadas com `Intl.DateTimeFormat('pt-BR')`.
- Sem mudanças no fluxo Asaas.

---

## Arquivos afetados

- `supabase/migrations/<timestamp>_championship_extras.sql` (novo)
- `src/routes/admin.campeonatos.index.tsx`
- `src/routes/campeonatos.$slug.tsx`
- `src/routes/inscricao.$categoryId.tsx`
- `src/integrations/supabase/types.ts` (auto)
