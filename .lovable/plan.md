## Causa raiz

A página `/admin/administradores` (e `/admin/campeonatos/$id/permissoes`) redireciona para `/admin` antes do papel `master` ser carregado, então o usuário sempre cai no Dashboard.

Em `src/hooks/useAuth.ts`:
- `loading` vira `false` assim que `getSession()` resolve.
- A consulta a `user_roles` (que define `isMaster`) acontece em um `useEffect` separado, depois disso.
- Existe uma janela em que `loading=false` e `isMaster=false`.

Em `src/routes/admin.administradores.tsx`:
```ts
useEffect(() => {
  if (!authLoading && !isMaster) navigate({ to: "/admin" });
}, [authLoading, isMaster, navigate]);
```
Esse efeito dispara nessa janela e manda o master de volta ao Dashboard. O mesmo padrão existe em `admin.campeonatos.$id.permissoes.tsx`.

Confirmei no banco que `junior@pexcelsp.com.br` tem o papel `master` (e `admin`), então o problema é puramente o race no front.

## Correção

1. **`src/hooks/useAuth.ts`** — adicionar um estado `rolesLoading` (inicia `true`, vira `false` no `.then` da consulta de `user_roles`, e também `false` quando não há `user`). Expor no retorno.
2. **`src/routes/admin.administradores.tsx`** — trocar o guard para esperar `rolesLoading`:
   - `if (!authLoading && !rolesLoading && !isMaster) navigate({ to: "/admin" })`
   - `if (authLoading || rolesLoading) return <loader/>`; só depois checar `isMaster`.
3. **`src/routes/admin.campeonatos.$id.permissoes.tsx`** — mesma mudança.
4. **`src/routes/admin.tsx`** — opcional mas recomendado: usar `rolesLoading` para não esconder o item "Administradores" da sidebar antes do papel chegar (atualmente ele só aparece quando `isMaster` é true, o que pode "piscar"). Mostrar o item só após `rolesLoading=false`.

## Validação
- Logar como master, clicar em "Administradores" → deve abrir a tela de gerenciamento (promover/revogar admins), sem redirecionar.
- Clicar em "Permissões" dentro de um campeonato → deve abrir a lista de admins do campeonato.
- Logar como admin não-master → ainda deve ser redirecionado para `/admin`.

## Arquivos alterados
- `src/hooks/useAuth.ts`
- `src/routes/admin.administradores.tsx`
- `src/routes/admin.campeonatos.$id.permissoes.tsx`
- `src/routes/admin.tsx`
