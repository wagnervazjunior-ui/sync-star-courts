import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const verifyAdminPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string().min(4).max(6) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_FINANCIAL_PIN;
    if (!expected) throw new Error("PIN financeiro não configurado — contate o suporte");
    if (data.pin !== expected) throw new Error("PIN incorreto");
    return { ok: true as const };
  });
