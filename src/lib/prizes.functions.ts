import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPixTransfer, getTransferReceiptUrl } from "./asaas.server";

const db = supabaseAdmin as any;

function newToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function getSiteUrl() {
  return (process.env.PUBLIC_SITE_URL ?? "https://www.opensync.com.br").replace(/\/$/, "");
}

async function assertMaster(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "master" as any).maybeSingle();
  if (!data) throw new Error("Apenas admin master pode gerenciar premiações");
}

async function sendPrizeEmail(prizeId: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const { data: prize } = await db.from("prize_registrations")
    .select("*, category:categories(name), championship:championships(name)")
    .eq("id", prizeId)
    .maybeSingle();
  if (!prize?.contact_email) return;

  const link = `${getSiteUrl()}/premiacao/cadastro/${prize.token}`;
  const placementLabel = prize.placement === 1 ? "1º lugar" : prize.placement === 2 ? "2º lugar" : "3º lugar";
  const catName = prize.category?.name ?? "";
  const champName = prize.championship?.name ?? "";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a1a1a">Parabéns, ${prize.team_name}! 🏆</h2>
      <p>Você conquistou o <strong>${placementLabel}</strong> na categoria <strong>${catName}</strong> do campeonato <strong>${champName}</strong>.</p>
      <p>Para receber a premiação em dinheiro via PIX, preencha seus dados clicando no botão abaixo:</p>
      <a href="${link}" style="display:inline-block;background:#6d28d9;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Cadastrar dados para recebimento</a>
      <p style="color:#666;font-size:13px">Ou acesse: <a href="${link}">${link}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#999;font-size:12px">Open Sync — Gestão de Campeonatos</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Open Sync <no-reply@opensync.com.br>",
      to: [prize.contact_email],
      subject: `🏆 ${placementLabel} — cadastre seus dados para receber a premiação`,
      html,
    }),
  });

  await db.from("prize_registrations").update({ email_sent_at: new Date().toISOString() }).eq("id", prizeId);
}

// ── Disparo automático ao finalizar bracket ─────────────────────────────────
export async function triggerPrizeNotificationsForBracket(bracketId: string) {
  const { data: bracket } = await supabaseAdmin
    .from("brackets")
    .select("id, category_id, championship_id")
    .eq("id", bracketId)
    .maybeSingle();
  if (!bracket) return;

  const { data: category } = await supabaseAdmin
    .from("categories")
    .select("id, has_prize")
    .eq("id", bracket.category_id)
    .maybeSingle();
  if (!category || !(category as any).has_prize) return;

  // Top 3 do bracket
  const { data: topTeams } = await supabaseAdmin
    .from("bracket_teams")
    .select("id, team_name, registration_id, final_rank")
    .eq("bracket_id", bracketId)
    .in("final_rank", [1, 2, 3])
    .order("final_rank");
  if (!topTeams?.length) return;

  for (const team of topTeams) {
    // Verificar se já existe registro de premiação para essa posição
    const { data: existing } = await db.from("prize_registrations")
      .select("id")
      .eq("bracket_id", bracketId)
      .eq("placement", team.final_rank)
      .maybeSingle();
    if (existing) continue;

    let contactEmail: string | null = null;
    if (team.registration_id) {
      const { data: reg } = await supabaseAdmin
        .from("registrations")
        .select("contact_email")
        .eq("id", team.registration_id)
        .maybeSingle();
      contactEmail = reg?.contact_email ?? null;
    }

    const token = newToken();
    const { data: prize, error } = await db.from("prize_registrations").insert({
      category_id: bracket.category_id,
      championship_id: bracket.championship_id,
      bracket_id: bracketId,
      placement: team.final_rank,
      team_name: team.team_name ?? `Dupla ${team.final_rank}`,
      contact_email: contactEmail,
      token,
    }).select("id").single();

    if (!error && prize && contactEmail) {
      await sendPrizeEmail(prize.id).catch(console.error);
    }
  }
}

// ── Admin: listar premiações de um campeonato ────────────────────────────────
export const listPrizes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ championship_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const { data: rows, error } = await db.from("prize_registrations")
      .select("*, category:categories(id, name)")
      .eq("championship_id", data.championship_id)
      .order("placement")
      .order("created_at");
    if (error) throw new Error(error.message);
    return { prizes: rows ?? [] };
  });

// ── Admin: criar premiação manualmente ──────────────────────────────────────
export const createPrizeManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      category_id: z.string().uuid(),
      championship_id: z.string().uuid(),
      placement: z.number().int().min(1).max(3),
      team_name: z.string().trim().min(1).max(120),
      contact_email: z.string().email().optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const token = newToken();
    const { data: prize, error } = await db.from("prize_registrations").insert({
      category_id: data.category_id,
      championship_id: data.championship_id,
      placement: data.placement,
      team_name: data.team_name,
      contact_email: data.contact_email || null,
      token,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: prize.id as string, token };
  });

// ── Admin: reenviar email ────────────────────────────────────────────────────
export const resendPrizeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prize_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    await sendPrizeEmail(data.prize_id);
    return { ok: true as const };
  });

// ── Admin: pagar premiação via Asaas ────────────────────────────────────────
export const payPrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      prize_id: z.string().uuid(),
      amount_cents: z.number().int().positive(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const { data: prize } = await db.from("prize_registrations")
      .select("*")
      .eq("id", data.prize_id)
      .maybeSingle();
    if (!prize) throw new Error("Premiação não encontrada");
    if (prize.status === "paid") throw new Error("Premiação já está paga");
    if (prize.status !== "registered") throw new Error("A dupla ainda não preencheu os dados bancários");

    const placementLabel = prize.placement === 1 ? "1º" : prize.placement === 2 ? "2º" : "3º";
    const description = `Premiação ${placementLabel} lugar — ${prize.team_name}`;

    let transfer1Id: string | null = null;
    let transfer2Id: string | null = null;

    if (prize.split_payment && prize.recipient2_pix_key) {
      const halfCents = Math.floor(data.amount_cents / 2);
      const t1 = await createPixTransfer({ pixKey: prize.recipient1_pix_key, pixKeyType: prize.recipient1_pix_type, valueCents: halfCents, description: `${description} (${prize.recipient1_name})` });
      const t2 = await createPixTransfer({ pixKey: prize.recipient2_pix_key, pixKeyType: prize.recipient2_pix_type, valueCents: data.amount_cents - halfCents, description: `${description} (${prize.recipient2_name})` });
      transfer1Id = t1.id;
      transfer2Id = t2.id;
    } else {
      const t1 = await createPixTransfer({ pixKey: prize.recipient1_pix_key, pixKeyType: prize.recipient1_pix_type, valueCents: data.amount_cents, description });
      transfer1Id = t1.id;
    }

    // Buscar URLs dos comprovantes (async, sem bloquear)
    const [receipt1, receipt2] = await Promise.all([
      transfer1Id ? getTransferReceiptUrl(transfer1Id).catch(() => null) : null,
      transfer2Id ? getTransferReceiptUrl(transfer2Id).catch(() => null) : null,
    ]);

    await db.from("prize_registrations").update({
      amount_cents: data.amount_cents,
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: context.userId,
      transfer1_asaas_id: transfer1Id,
      transfer2_asaas_id: transfer2Id,
      receipt1_url: receipt1,
      receipt2_url: receipt2,
    }).eq("id", data.prize_id);

    return { ok: true as const, transfer1_id: transfer1Id, transfer2_id: transfer2Id };
  });

// ── Admin: preencher dados da dupla diretamente ─────────────────────────────
export const adminFillPrizeData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      prize_id: z.string().uuid(),
      recipient1_name: z.string().trim().min(2).max(120),
      recipient1_pix_key: z.string().trim().min(1).max(200),
      recipient1_pix_type: z.enum(["cpf", "email", "phone", "random"]),
      split_payment: z.boolean(),
      recipient2_name: z.string().trim().min(2).max(120).optional(),
      recipient2_pix_key: z.string().trim().min(1).max(200).optional(),
      recipient2_pix_type: z.enum(["cpf", "email", "phone", "random"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const { data: prize } = await db.from("prize_registrations")
      .select("id, status")
      .eq("id", data.prize_id)
      .maybeSingle();
    if (!prize) throw new Error("Premiação não encontrada");
    if (prize.status === "paid") throw new Error("Esta premiação já foi paga");

    await db.from("prize_registrations").update({
      registered_at: new Date().toISOString(),
      recipient1_name: data.recipient1_name,
      recipient1_pix_key: data.recipient1_pix_key.trim(),
      recipient1_pix_type: data.recipient1_pix_type,
      split_payment: data.split_payment,
      recipient2_name: data.split_payment ? data.recipient2_name ?? null : null,
      recipient2_pix_key: data.split_payment ? data.recipient2_pix_key?.trim() ?? null : null,
      recipient2_pix_type: data.split_payment ? data.recipient2_pix_type ?? null : null,
      status: "registered",
    }).eq("id", data.prize_id);

    return { ok: true as const };
  });

// ── Admin: excluir premiação ─────────────────────────────────────────────────
export const deletePrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prize_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    await db.from("prize_registrations").delete().eq("id", data.prize_id);
    return { ok: true as const };
  });

// ── Público: ver convite ─────────────────────────────────────────────────────
export const getPrizeInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { data: prize } = await db.from("prize_registrations")
      .select("id, placement, team_name, status, category:categories(name), championship:championships(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!prize) return { ok: false as const };
    return { ok: true as const, prize };
  });

// ── Público: registrar dados da dupla ───────────────────────────────────────
const PixType = z.enum(["cpf", "email", "phone", "random"]);

export const registerPrizeData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().min(1),
      recipient1_name: z.string().trim().min(2).max(120),
      recipient1_pix_key: z.string().trim().min(1).max(200),
      recipient1_pix_type: PixType,
      split_payment: z.boolean(),
      recipient2_name: z.string().trim().min(2).max(120).optional(),
      recipient2_pix_key: z.string().trim().min(1).max(200).optional(),
      recipient2_pix_type: PixType.optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: prize } = await db.from("prize_registrations")
      .select("id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!prize) throw new Error("Link inválido");
    if (prize.status === "paid") throw new Error("Esta premiação já foi paga");

    await db.from("prize_registrations").update({
      registered_at: new Date().toISOString(),
      recipient1_name: data.recipient1_name,
      recipient1_pix_key: data.recipient1_pix_key.trim(),
      recipient1_pix_type: data.recipient1_pix_type,
      split_payment: data.split_payment,
      recipient2_name: data.split_payment ? data.recipient2_name ?? null : null,
      recipient2_pix_key: data.split_payment ? data.recipient2_pix_key?.trim() ?? null : null,
      recipient2_pix_type: data.split_payment ? data.recipient2_pix_type ?? null : null,
      status: "registered",
    }).eq("id", prize.id);

    return { ok: true as const };
  });

// ── Admin: exportar Excel ─────────────────────────────────────────────────────
export const exportPrizesXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ championship_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const { data: rows } = await db.from("prize_registrations")
      .select("*, category:categories(name), championship:championships(name)")
      .eq("championship_id", data.championship_id)
      .order("category_id")
      .order("placement");

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Premiações");

    // Cabeçalho
    ws.columns = [
      { header: "Categoria", key: "cat", width: 25 },
      { header: "Colocação", key: "placement", width: 12 },
      { header: "Dupla", key: "team", width: 25 },
      { header: "Status", key: "status", width: 14 },
      { header: "Recebedor 1", key: "r1", width: 25 },
      { header: "Tipo PIX 1", key: "pix1type", width: 14 },
      { header: "Chave PIX 1", key: "pix1", width: 30 },
      { header: "Recebedor 2", key: "r2", width: 25 },
      { header: "Tipo PIX 2", key: "pix2type", width: 14 },
      { header: "Chave PIX 2", key: "pix2", width: 30 },
      { header: "Divisão", key: "split", width: 10 },
      { header: "Valor (R$)", key: "amount", width: 14 },
      { header: "Pago em", key: "paid_at", width: 20 },
      { header: "Comprovante 1", key: "rec1", width: 50 },
      { header: "Comprovante 2", key: "rec2", width: 50 },
    ];

    // Estilo do cabeçalho
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    let lastCat = "";
    for (const r of rows ?? []) {
      const catName = r.category?.name ?? "";

      // Linha separadora de categoria
      if (catName !== lastCat) {
        if (lastCat !== "") ws.addRow({}); // linha em branco entre categorias
        const sepRow = ws.addRow({ cat: `── ${catName} ──` });
        sepRow.font = { bold: true, italic: true };
        sepRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } };
        ws.mergeCells(sepRow.number, 1, sepRow.number, 15);
        lastCat = catName;
      }

      const dataRow = ws.addRow({
        cat: catName,
        placement: r.placement === 1 ? "🥇 1º lugar" : r.placement === 2 ? "🥈 2º lugar" : "🥉 3º lugar",
        team: r.team_name,
        status: { pending: "Aguardando", registered: "Dados OK", paid: "Pago", cancelled: "Cancelado" }[r.status as string] ?? r.status,
        r1: r.recipient1_name ?? "",
        pix1type: r.recipient1_pix_type ?? "",
        pix1: r.recipient1_pix_key ?? "",
        r2: r.recipient2_name ?? "",
        pix2type: r.recipient2_pix_type ?? "",
        pix2: r.recipient2_pix_key ?? "",
        split: r.split_payment ? "Sim" : "Não",
        amount: r.amount_cents != null ? (r.amount_cents / 100).toFixed(2) : "",
        paid_at: r.paid_at ? new Date(r.paid_at).toLocaleString("pt-BR") : "",
        rec1: r.receipt1_url ?? "",
        rec2: r.receipt2_url ?? "",
      });

      // Comprovantes como hyperlink quando disponíveis
      if (r.receipt1_url) {
        dataRow.getCell("rec1").value = { text: "Ver comprovante", hyperlink: r.receipt1_url };
        dataRow.getCell("rec1").font = { color: { argb: "FF6D28D9" }, underline: true };
      }
      if (r.receipt2_url) {
        dataRow.getCell("rec2").value = { text: "Ver comprovante", hyperlink: r.receipt2_url };
        dataRow.getCell("rec2").font = { color: { argb: "FF6D28D9" }, underline: true };
      }

      // Destacar pagos em verde claro
      if (r.status === "paid") {
        dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4EA" } };
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    return { base64: Buffer.from(buf).toString("base64") };
  });
