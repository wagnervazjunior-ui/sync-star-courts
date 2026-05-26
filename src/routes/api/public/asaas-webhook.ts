import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendVoucherConfirmationEmail } from "@/lib/email/send-voucher.server";

const Payload = z.object({
  event: z.string(),
  payment: z
    .object({
      id: z.string(),
      externalReference: z.string().uuid().nullish(),
      status: z.string().nullish(),
    })
    .passthrough(),
});

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        const provided = request.headers.get("asaas-access-token") ?? "";

        // If the token is configured, enforce it. If it isn't, accept (mock mode)
        // so we can wire the URL into the Asaas dashboard later without breaking.
        if (expected) {
          if (!provided || !timingSafeEqual(provided, expected)) {
            return new Response("Invalid token", { status: 401 });
          }
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = Payload.safeParse(json);
        if (!parsed.success) return new Response("Bad payload", { status: 400 });

        const { event, payment } = parsed.data;
        const registrationId = payment.externalReference ?? null;
        if (!registrationId) return new Response("ok"); // not ours

        try {
          if (
            event === "PAYMENT_RECEIVED" ||
            event === "PAYMENT_CONFIRMED" ||
            event === "PAYMENT_APPROVED_BY_RISK_ANALYSIS"
          ) {
            await supabaseAdmin.rpc("confirm_registration_by_payment", {
              _payment_id: payment.id,
              _registration_id: registrationId,
            });
            await sendVoucherConfirmationEmail(registrationId);
          } else if (event === "PAYMENT_AWAITING_RISK_ANALYSIS") {
            await supabaseAdmin.rpc("set_registration_processing", {
              _payment_id: payment.id,
              _registration_id: registrationId,
            });
          } else if (event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
            await supabaseAdmin
              .from("registrations")
              .update({ status: "cancelled" })
              .eq("id", registrationId)
              .neq("status", "confirmed");
          } else if (
            event === "PAYMENT_REFUNDED" ||
            event === "PAYMENT_DELETED" ||
            event === "PAYMENT_OVERDUE" ||
            event === "PAYMENT_CHARGEBACK_REQUESTED"
          ) {
            // Idempotent: only cancel if not already confirmed (avoid out-of-order events
            // reverting a confirmed payment). For real refunds after confirmation, use admin UI.
            await supabaseAdmin
              .from("registrations")
              .update({ status: "cancelled" })
              .eq("id", registrationId)
              .neq("status", "confirmed");
          }
        } catch (err) {
          console.error("[asaas-webhook] handler error", err);
          return new Response("Internal error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
