import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Payload = z.object({
  type: z.enum(["TRANSFER", "BILL", "PIX_QR_CODE", "MOBILE_PHONE_RECHARGE", "PIX_REFUND"]),
});

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const Route = createFileRoute("/api/public/asaas-transfer-auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ASAAS_TRANSFER_VALIDATION_TOKEN;
        const provided = request.headers.get("asaas-access-token") ?? "";

        if (!expected) {
          console.error("[asaas-transfer-validation] ASAAS_TRANSFER_VALIDATION_TOKEN not configured");
          return Response.json({ status: "REFUSED", refuseReason: "Webhook not configured" }, { status: 503 });
        }
        if (!provided || !timingSafeEqual(provided, expected)) {
          return Response.json({ status: "REFUSED", refuseReason: "Invalid token" }, { status: 401 });
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ status: "REFUSED", refuseReason: "Invalid JSON" }, { status: 400 });
        }

        const parsed = Payload.safeParse(json);
        if (!parsed.success) {
          console.warn("[asaas-transfer-validation] unknown payload type", json);
          // Approve unknown types to avoid blocking legitimate transfers from new Asaas features
          return Response.json({ status: "APPROVED" });
        }

        console.info("[asaas-transfer-validation] approving", parsed.data.type);
        return Response.json({ status: "APPROVED" });
      },
    },
  },
});
