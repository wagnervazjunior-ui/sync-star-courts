import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findOrCreateCustomer,
  createPixCharge as asaasCreatePixCharge,
  getPixQrCode,
  isAsaasMock,
} from "./asaas.server";

const Input = z.object({ voucher: z.string().min(4).max(32) });

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const voucher = data.voucher.toUpperCase();

    // Load registration + category info
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registrations")
      .select(
        "id, status, contact_email, contact_phone, athlete1_name, asaas_payment_id, pix_qr_code, pix_qr_code_base64, pix_expires_at, amount_cents, category:categories(id, name, price_cents, championship:championships(name))",
      )
      .eq("voucher_code", voucher)
      .maybeSingle();

    if (regErr) throw new Error(regErr.message);
    if (!reg) throw new Error("Inscrição não encontrada");
    if (reg.status === "confirmed") {
      return { status: "confirmed" as const, mock: isAsaasMock() };
    }
    if (reg.status === "cancelled") {
      throw new Error("Inscrição cancelada");
    }

    // If we already have a fresh PIX, return it.
    const stillValid =
      reg.pix_qr_code &&
      reg.pix_qr_code_base64 &&
      reg.pix_expires_at &&
      new Date(reg.pix_expires_at).getTime() > Date.now() + 60_000;
    if (stillValid) {
      return {
        status: "pending" as const,
        mock: isAsaasMock(),
        qrCodeBase64: reg.pix_qr_code_base64!,
        payload: reg.pix_qr_code!,
        expiresAt: reg.pix_expires_at!,
        amountCents: reg.amount_cents ?? reg.category?.price_cents ?? 0,
      };
    }

    const cat: any = reg.category;
    const valueCents = cat?.price_cents ?? 0;
    if (valueCents <= 0) throw new Error("Categoria sem preço configurado");

    const customer = await findOrCreateCustomer({
      name: reg.athlete1_name,
      email: reg.contact_email,
      phone: reg.contact_phone,
      externalReference: reg.id,
    });

    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const charge = await asaasCreatePixCharge({
      customerId: customer.id,
      valueCents,
      description: `${cat?.championship?.name ?? "Inscrição"} — ${cat?.name ?? ""} (voucher ${voucher})`,
      externalReference: reg.id,
      dueDate,
    });

    const qr = await getPixQrCode(charge.id);

    const { error: upErr } = await supabaseAdmin.rpc("set_registration_pix", {
      _id: reg.id,
      _payment_id: charge.id,
      _customer_id: customer.id,
      _qr: qr.payload,
      _qr_b64: qr.encodedImage,
      _expires_at: qr.expirationDate,
      _amount_cents: valueCents,
    });
    if (upErr) throw new Error(upErr.message);

    return {
      status: "pending" as const,
      mock: isAsaasMock(),
      qrCodeBase64: qr.encodedImage,
      payload: qr.payload,
      expiresAt: qr.expirationDate,
      amountCents: valueCents,
    };
  });
