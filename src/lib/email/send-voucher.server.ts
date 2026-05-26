// Sends the voucher confirmation email via Resend (through the Lovable connector gateway).
// Safe to call from webhooks / server fns; never throws.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildVoucherEmailHtml, buildVoucherEmailSubject } from "@/lib/email-templates/voucher-confirmed";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function getSiteUrl() {
  return (
    process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sync-star-courts.lovable.app"
  );
}

export async function sendVoucherConfirmationEmail(registrationId: string) {
  try {
    const { data: reg, error } = await supabaseAdmin
      .from("registrations")
      .select(
        `id, voucher_code, contact_email, team_name, amount_cents,
         athlete1_name, athlete1_shirt_size,
         athlete2_name, athlete2_shirt_size,
         category:categories(name, price_cents, championship:championships(name))`,
      )
      .eq("id", registrationId)
      .maybeSingle();

    if (error || !reg) {
      console.warn("[send-voucher] registration not found", registrationId, error?.message);
      return;
    }
    if (!reg.contact_email) {
      console.warn("[send-voucher] no contact_email for", registrationId);
      return;
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      console.warn("[send-voucher] Resend not configured — skipping send", { registrationId });
      return;
    }

    const cat: any = reg.category;
    const siteUrl = getSiteUrl();
    const voucherUrl = `${siteUrl}/voucher/${reg.id}`;
    const successUrl = `${siteUrl}/sucesso/${reg.voucher_code}`;

    const data = {
      voucherCode: reg.voucher_code,
      championshipName: cat?.championship?.name ?? "Open Sync",
      categoryName: cat?.name ?? "",
      teamName: reg.team_name || null,
      athlete1Name: reg.athlete1_name,
      athlete1Shirt: reg.athlete1_shirt_size,
      athlete2Name: reg.athlete2_name,
      athlete2Shirt: reg.athlete2_shirt_size,
      voucherUrl,
      successUrl,
      amountCents: reg.amount_cents ?? cat?.price_cents ?? 0,
    };

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Open Sync <onboarding@resend.dev>",
        to: [reg.contact_email],
        subject: buildVoucherEmailSubject(data),
        html: buildVoucherEmailHtml(data),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[send-voucher] Resend failed", res.status, body);
      return;
    }
    console.info("[send-voucher] sent", { to: reg.contact_email, voucher: reg.voucher_code });
  } catch (err) {
    console.error("[send-voucher] unexpected error", err);
  }
}
