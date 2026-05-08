## Mudanças

### 1. Corrigir bug "Categorias" não abre

Renomear `src/routes/admin.campeonatos.tsx` → `src/routes/admin.campeonatos.index.tsx`. No TanStack flat routing, `admin.campeonatos.tsx` virou layout pai de `admin.campeonatos.$id.tsx` mas não renderiza `<Outlet />`, por isso o detalhe não aparece. Renomeando para `.index.tsx`, ele responde só por `/admin/campeonatos` e o detalhe passa a abrir.

### 2. Upload de imagem da capa do campeonato (substituir campo URL)

**Backend (migration):**
- Criar bucket público `championship-covers`.
- Políticas em `storage.objects`:
  - SELECT público (qualquer um lê).
  - INSERT/UPDATE/DELETE apenas para admins (`has_role(auth.uid(),'admin')`).

**Frontend (`admin.campeonatos.index.tsx` → `ChampionshipDialog`):**
- Remover o `Input` de "URL da imagem de capa".
- Adicionar:
  - Preview da imagem (se `cover_image_url` existir).
  - `<input type="file" accept="image/*">` estilizado como botão.
  - Botão "Remover imagem" (apenas limpa o `cover_image_url` do form; não apaga o arquivo no storage para não quebrar referências).
- Ao escolher arquivo:
  1. Upload para `championship-covers/<uuid>.<ext>` via `supabase.storage`.
  2. `getPublicUrl` → preencher `form.cover_image_url`.
  3. Toast de sucesso/erro.
- Estado de loading durante upload (desabilita o botão Salvar).

### Fora do escopo
- Limpeza automática de imagens antigas órfãs.
- Crop/redimensionamento no cliente.
