import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildVoucherEmailHtml, buildVoucherEmailSubject } from "@/lib/email-templates/voucher-confirmed";

function getSiteUrl() {
  return (
    process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://www.opensync.com.br"
  );
}

export async function sendVoucherConfirmationEmail(registrationId: string) {
  try {
    const { data: reg, error } = await supabaseAdmin
      .from("registrations")
      .select(
        `id, voucher_code, contact_email, team_name, amount_cents,
         athlete1_name, athlete1_shirt_size, athlete1_shorts_size,
         athlete2_name, athlete2_shirt_size, athlete2_shorts_size,
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

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.warn("[send-voucher] RESEND_API_KEY not configured — skipping email", { registrationId });
      return;
    }

    const cat: any = reg.category;
    const siteUrl = getSiteUrl();
    const voucherUrl = `${siteUrl}/voucher/${reg.id}`;
    const successUrl = `${siteUrl}/sucesso/${reg.voucher_code}`;

    const emailData = {
      voucherCode: reg.voucher_code,
      championshipName: cat?.championship?.name ?? "Open Sync",
      categoryName: cat?.name ?? "",
      teamName: reg.team_name || null,
      athlete1Name: reg.athlete1_name,
      athlete1Shirt: reg.athlete1_shirt_size,
      athlete1Shorts: reg.athlete1_shorts_size,
      athlete2Name: reg.athlete2_name,
      athlete2Shirt: reg.athlete2_shirt_size,
      athlete2Shorts: reg.athlete2_shorts_size,
      voucherUrl,
      successUrl,
      amountCents: reg.amount_cents ?? cat?.price_cents ?? 0,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Open Sync <no-reply@opensync.com.br>",
        to: [reg.contact_email],
        subject: buildVoucherEmailSubject(emailData),
        html: buildVoucherEmailHtml(emailData),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[send-voucher] Resend failed", { status: res.status, body, to: reg.contact_email });
      return;
    }

    await supabaseAdmin
      .from("registrations")
      .update({ last_email_sent_at: new Date().toISOString() })
      .eq("id", registrationId);

    console.info("[send-voucher] sent", { to: reg.contact_email, voucher: reg.voucher_code });
  } catch (err) {
    console.error("[send-voucher] unexpected error", err);
  }
}
