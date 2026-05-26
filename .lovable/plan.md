## Objetivo

Entregar o voucher para a dupla por dois canais:
1. **WhatsApp** — botão na tela de sucesso que abre o WhatsApp com mensagem pronta (link `wa.me`, sem custo, sem API).
2. **Email** — envio automático assim que o pagamento é confirmado pelo Asaas, com o voucher e dados da inscrição.

## 1. WhatsApp (link wa.me)

Na tela `/sucesso/:voucher`, abaixo do card de status, adicionar um botão **"Enviar voucher pelo WhatsApp"** que:
- Usa o `contact_phone` salvo na inscrição (já em formato BR).
- Normaliza para E.164 sem `+` (ex: `5511999999999`).
- Abre `https://wa.me/<phone>?text=<mensagem>` em nova aba.
- Mensagem pronta: nome do campeonato, categoria, voucher, valor e link da página de sucesso.

Mostrar o botão tanto para inscrições pendentes quanto confirmadas, para a dupla compartilhar entre os atletas.

## 2. Email com voucher (após pagamento confirmado)

### Fluxo
- O webhook do Asaas (`/api/public/asaas-webhook`) já chama `confirm_registration_by_payment` quando o pagamento é confirmado.
- Após essa confirmação, enfileirar um email para o `contact_email` da inscrição.
- Idempotência: usar `voucher-confirmed-{registration_id}` como chave para evitar duplicatas em caso de re-entrega do webhook.

### Conteúdo do email
- Assunto: "Inscrição confirmada — {Campeonato} • Voucher {OS-XXXXXX}"
- Corpo: saudação com nome da dupla, voucher em destaque, categoria, valor pago, nomes dos atletas, link para a página de sucesso, e mensagem do que esperar no dia do evento.

### Infraestrutura
- Usar Lovable Emails (built-in). Domínio fica para configurar no final — o setup do domínio é pré-requisito para envios reais, mas posso já deixar todo o código pronto.
- Quando o usuário decidir configurar o domínio, abrir o diálogo de setup, scaffold da infra de email transacional (`setup_email_infra` + `scaffold_transactional_email`) e criar o template React Email `voucher-confirmed.tsx`.
- O webhook chamará o helper `sendTransactionalEmail` com o template `voucher-confirmed`.

### Ordem de execução
Como o usuário pediu para configurar domínio só no final, vou:
1. Implementar agora o botão de WhatsApp na tela de sucesso (entrega imediata).
2. Implementar a chamada de envio de email no webhook do Asaas, mas deixar isolada num helper que não quebra se a infra de email ainda não estiver pronta (try/catch + log, sem falhar o webhook).
3. Quando você pedir para configurar o domínio, eu rodo o scaffold da infra de email, crio o template e ativo o envio real.

## Arquivos afetados

- `src/routes/sucesso.$voucher.tsx` — adicionar botão WhatsApp.
- `src/routes/api/public/asaas-webhook.ts` — após confirmar pagamento, disparar envio de email (com try/catch).
- `src/lib/email/send-voucher.ts` (novo) — helper que monta payload e chama o envio; no-op silencioso se infra ainda não existe.

## Fora de escopo (por ora)

- Envio automático por WhatsApp via Twilio (custo + verificação WhatsApp Business).
- Email no momento da criação da inscrição (apenas após confirmação, conforme escolhido).
- Configuração do domínio de email (será feita no final).