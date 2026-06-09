import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendVoucherConfirmationEmail } from "@/lib/email/send-voucher.server";

// Public server fn: load voucher data by registration UUID.
// Returns only fields safe for public display (no CPF, no email/phone, no payment IDs).
export const getVoucherById = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: reg, error } = await supabaseAdmin
      .from("registrations")
      .select(
        `id, voucher_code, status, team_name,
         athlete1_name, athlete1_shirt_size, athlete1_shorts_size,
         athlete2_name, athlete2_shirt_size, athlete2_shorts_size,
         category:categories(name, championship:championships(name, location, start_date, end_date))`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return reg;
  });

// Public server fn: find registrations by contact email.
export const getVouchersByEmail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const { data: regs, error } = await supabaseAdmin
      .from("registrations")
      .select(
        `id, voucher_code, status, team_name, created_at,
         category:categories(name, championship:championships(name))`,
      )
      .eq("contact_email", data.email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return regs ?? [];
  });

// Public server fn: resend the confirmation email for a confirmed registration.
// Rate-limited to one send per 60 seconds per registration.
export const resendVoucherEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: reg, error } = await supabaseAdmin
      .from("registrations")
      .select("id, status, last_email_sent_at, contact_email")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reg) throw new Error("Inscrição não encontrada");
    if (reg.status !== "confirmed") {
      throw new Error("E-mail só pode ser reenviado para inscrições confirmadas");
    }
    if (reg.last_email_sent_at) {
      const last = new Date(reg.last_email_sent_at).getTime();
      if (Date.now() - last < 60_000) {
        throw new Error("Aguarde 60 segundos antes de reenviar");
      }
    }
    await sendVoucherConfirmationEmail(reg.id);
    return { ok: true as const, to: reg.contact_email };
  });
