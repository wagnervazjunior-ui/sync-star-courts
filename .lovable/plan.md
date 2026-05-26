## Termo de aceite na inscrição + campo de premiação

### 1. Banco de dados
Migration em `public.categories`:
- `prize TEXT` (nullable) — campo dedicado de premiação

Migration em `public.registrations`:
- `terms_accepted BOOLEAN NOT NULL DEFAULT false`
- `terms_accepted_at TIMESTAMPTZ`

Atualizar a função `create_registration(payload)`:
- Validar `(payload->>'terms_accepted')::boolean = true`, senão `RAISE EXCEPTION 'TERMS_NOT_ACCEPTED'`
- Gravar `terms_accepted = true` e `terms_accepted_at = now()` no INSERT (timestamp server-side, garantia jurídica)

### 2. Admin — cadastro de categoria (`src/routes/admin.campeonatos.$id.tsx`)
- Adicionar campo **Premiação** (Textarea) no formulário de criação/edição de categoria, salvando em `categories.prize`
- Manter o campo Descrição existente

### 3. Formulário de inscrição (`src/routes/inscricao.$categoryId.tsx`)

Schema Zod:
- `terms_accepted: z.literal(true, { errorMap: () => ({ message: "Você precisa aceitar o termo" }) })`

Novo bloco antes do botão final — **Termo de Responsabilidade, Uso de Imagem e Regulamento**:

- **Seção 1 — Regulamento & Premiação**
  - Renderiza `ctx.championship.regulations`
  - Destaca `ctx.prize` (premiação da categoria selecionada)
- **Seção 2 — Direito de Imagem**
  - Texto jurídico fixo: *"Ao confirmar esta inscrição, ambos os atletas da dupla declaram estar cientes e de pleno acordo com o regulamento do torneio. Adicionalmente, autorizam de forma gratuita, irrevogável e irretratável a cessão e o uso de imagem e som da dupla, capturados através de fotos e filmagens durante o torneio e cerimônias de premiação, para fins de divulgação, cobertura de mídia e publicidade oficial do Evento e seus organizadores."*

Checkbox (shadcn) com label: *"Li e aceito o regulamento da categoria, a premiação estipulada e a liberação do uso de imagem da dupla para o torneio."*

Botão **"Confirmar inscrição"** com `disabled={!form.watch("terms_accepted") || submitting}`.

`onSubmit` envia `terms_accepted: true` no payload do RPC.

### 4. Admin — trilha de auditoria
Em `/admin/inscricoes`, exibir `terms_accepted_at` (data/hora formatada) no detalhe da inscrição como prova de aceite.
