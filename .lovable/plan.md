## Plano: ajustes de performance

### 1. `staleTime` global no QueryClient
- Em `src/router.tsx`, ao criar o `QueryClient` dentro de `getRouter()`, configurar:
  - `defaultOptions.queries.staleTime: 30_000` (30s — clicks entre abas/voltar não disparam refetch)
  - `defaultOptions.queries.gcTime: 5 * 60_000` (5min em cache)
  - `refetchOnWindowFocus: false` (evita refetch toda vez que a aba volta a foco)
- Manter `defaultPreloadStaleTime: 0` no router (já documentado para integração com Query).
- Ganho: navegação no admin fica praticamente instantânea entre telas já visitadas; reduz queries redundantes ao Supabase.

### 2. RPC `dashboard_stats` (substitui contagem no cliente)
Hoje `admin.index.tsx` faz `select` em **todas** as `registrations` e conta no JS — cresce O(n) e fica pesado.

- **Migration SQL**: criar função `public.dashboard_stats(_championship_id uuid DEFAULT NULL)`:
  - `SECURITY DEFINER`, `STABLE`, `search_path = public`
  - Verifica permissão: se `_championship_id` for `NULL`, exige `has_role(auth.uid(),'master')`; se vier um id, exige `can_view_championship(auth.uid(), _championship_id)`.
  - Retorna `TABLE(total bigint, pending bigint, confirmed bigint, cancelled bigint, revenue_cents bigint)` usando `count(*) FILTER (WHERE status = ...)` e `SUM(price_cents) FILTER (WHERE status='confirmed')` com `JOIN categories`.
  - Quando `_championship_id` é `NULL` para master: agrega tudo. Para admin não-master sem id: erro (UI sempre passará id ou usará lista de campeonatos visíveis — ver abaixo).
- **Índice complementar** (se ainda não existir explicitamente): `registrations(category_id, status)` — já planejado anteriormente, confirmar.
- **Front (`src/routes/admin.index.tsx`)**:
  - Trocar a query atual por `supabase.rpc('dashboard_stats', { _championship_id: championshipId === 'all' ? null : championshipId })`.
  - Para admin não-master com `"all"` selecionado, iterar sobre `list_manageable_championships()` e somar — ou simplesmente forçar seleção de um campeonato (default: primeiro da lista). Recomendo **default no primeiro campeonato visível** em vez de "all" para não-master, evita N chamadas.
  - Card "Campeonatos ativos" continua usando o resultado de `list_manageable_championships()`.

### Arquivos
- `src/router.tsx` (defaultOptions do QueryClient)
- Nova migration SQL (`dashboard_stats` RPC)
- `src/routes/admin.index.tsx` (trocar contagem cliente por RPC)

### Garantias
- **Sem mudança de comportamento visível** além da velocidade.
- **Segurança preservada**: a RPC valida papel/visibilidade antes de retornar números.
- **Escala**: dashboard deixa de baixar todas as inscrições — passa a fazer 1 query agregada no banco (ms, não segundos).
