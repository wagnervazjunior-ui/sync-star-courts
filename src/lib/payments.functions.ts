import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findOrCreateCustomer,
  createPixCharge as asaasCreatePixCharge,
  createCreditCardCharge as asaasCreateCardCharge,
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

const CardInput = z.object({
  voucher: z.string().min(4).max(32),
  holderName: z.string().min(3).max(80),
  cardNumber: z.string().min(13).max(19),
  expiryMonth: z.string().regex(/^\d{2}$/),
  expiryYear: z.string().regex(/^\d{4}$/),
  ccv: z.string().regex(/^\d{3,4}$/),
  holderCpf: z.string().min(11).max(14),
  holderPostalCode: z.string().min(8).max(9),
  holderAddressNumber: z.string().min(1).max(20),
  holderAddress: z.string().min(2).max(120),
  holderNeighborhood: z.string().min(2).max(80),
  holderCity: z.string().min(2).max(80),
  holderState: z.string().min(2).max(2),
  holderComplement: z.string().max(60).optional().or(z.literal("")),
  installments: z.number().int().min(1).max(12),
});

export const createCardCharge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CardInput.parse(input))
  .handler(async ({ data }) => {
    const voucher = data.voucher.toUpperCase();

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registrations")
      .select(
        "id, status, contact_email, contact_phone, athlete1_name, asaas_payment_id, amount_cents, category:categories(id, name, price_cents, championship:championships(name))",
      )
      .eq("voucher_code", voucher)
      .maybeSingle();

    if (regErr) throw new Error(regErr.message);
    if (!reg) throw new Error("Inscrição não encontrada");
    if (reg.status === "confirmed") {
      return { status: "confirmed" as const };
    }
    if (reg.status === "cancelled") throw new Error("Inscrição cancelada");

    const cat: any = reg.category;
    const valueCents = cat?.price_cents ?? 0;
    if (valueCents <= 0) throw new Error("Categoria sem preço configurado");

    const cleanCpf = data.holderCpf.replace(/\D/g, "");
    const cleanCep = data.holderPostalCode.replace(/\D/g, "");
    const cleanCard = data.cardNumber.replace(/\s|-/g, "");
    const cleanPhone = (reg.contact_phone ?? "").replace(/\D/g, "");

    // Persist payer info + chosen method first (so admin sees it even if charge fails)
    await supabaseAdmin.rpc("set_registration_payer", {
      _id: reg.id,
      _cpf: cleanCpf,
      _postal_code: cleanCep,
      _payment_method: "credit_card",
      _installments: data.installments,
    });

    const customer = await findOrCreateCustomer({
      name: data.holderName,
      email: reg.contact_email,
      phone: cleanPhone,
      cpfCnpj: cleanCpf,
      externalReference: reg.id,
    });

    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const remoteIp = (() => {
      try {
        return getRequestIP({ xForwardedFor: true }) ?? "0.0.0.0";
      } catch {
        return "0.0.0.0";
      }
    })();

    let charge;
    try {
      charge = await asaasCreateCardCharge({
        customerId: customer.id,
        valueCents,
        description: `${cat?.championship?.name ?? "Inscrição"} — ${cat?.name ?? ""} (voucher ${voucher})`,
        externalReference: reg.id,
        dueDate,
        installmentCount: data.installments,
        remoteIp,
        creditCard: {
          holderName: data.holderName,
          number: cleanCard,
          expiryMonth: data.expiryMonth,
          expiryYear: data.expiryYear,
          ccv: data.ccv,
        },
        creditCardHolderInfo: {
          name: data.holderName,
          email: reg.contact_email,
          cpfCnpj: cleanCpf,
          postalCode: cleanCep,
          addressNumber: data.holderAddressNumber,
          phone: cleanPhone || undefined,
        },
      });
    } catch (err: any) {
      // Do NOT change status — keep pending so user can try again
      const msg = String(err?.message ?? "");
      // Extract Asaas error description if possible
      const match = msg.match(/"description":"([^"]+)"/);
      const friendly = match?.[1] ?? "Cartão recusado. Verifique os dados ou tente outro cartão.";
      return { status: "failed" as const, error: friendly, mock: isAsaasMock() };
    }

    const status = (charge.status ?? "").toUpperCase();
    if (status === "CONFIRMED" || status === "RECEIVED" || status === "RECEIVED_IN_CASH") {
      await supabaseAdmin.rpc("confirm_registration_by_payment", {
        _payment_id: charge.id,
        _registration_id: reg.id,
      });
      return { status: "confirmed" as const, mock: isAsaasMock() };
    }
    if (status === "AWAITING_RISK_ANALYSIS") {
      await supabaseAdmin.rpc("set_registration_processing", {
        _payment_id: charge.id,
        _registration_id: reg.id,
      });
      return { status: "processing" as const, mock: isAsaasMock() };
    }
    // Pending / other — treat as processing
    await supabaseAdmin
      .from("registrations")
      .update({ asaas_payment_id: charge.id })
      .eq("id", reg.id);
    return { status: "processing" as const, mock: isAsaasMock() };
  });
