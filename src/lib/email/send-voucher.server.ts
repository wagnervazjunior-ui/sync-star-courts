// Helper to email the voucher to the dupla after payment confirmation.
// Currently a no-op stub — will dispatch via Lovable Emails once the
// sender domain is configured. Safe to call from webhooks; never throws.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function sendVoucherConfirmationEmail(registrationId: string) {
  try {
    const { data: reg, error } = await supabaseAdmin
      .from("registrations")
      .select(
        "id, voucher_code, contact_email, team_name, athlete1_name, athlete2_name, amount_cents, category:categories(name, championship:championships(name, slug))"
      )
      .eq("id", registrationId)
      .maybeSingle();
    if (error || !reg) {
      console.warn("[send-voucher] registration not found", registrationId, error?.message);
      return;
    }
    // TODO: once the email sender domain is configured, dispatch the
    // 'voucher-confirmed' transactional template here.
    console.info("[send-voucher] would email", {
      to: reg.contact_email,
      voucher: reg.voucher_code,
      team: reg.team_name,
    });
  } catch (err) {
    console.error("[send-voucher] unexpected error", err);
  }
}
