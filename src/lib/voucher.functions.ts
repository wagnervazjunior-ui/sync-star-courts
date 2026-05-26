import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
