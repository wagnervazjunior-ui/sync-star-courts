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

const Input = z.object({
  voucher: z.string().min(4).max(32),
  cpf: z.string().min(11).max(14).optional(),
});

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const voucher = data.voucher.toUpperCase();

    // Load registration + category info
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registrations")
      .select(
        "id, status, contact_email, contact_phone, athlete1_name, asaas_payment_id, pix_qr_code, pix_qr_code_base64, pix_expires_at, amount_cents, payer_cpf, category:categories(id, name, price_cents, championship:championships(name))",
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

    const cleanCpf = (data.cpf ?? reg.payer_cpf ?? "").replace(/\D/g, "");
    if (!cleanCpf || cleanCpf.length < 11) {
      throw new Error("CPF_REQUIRED");
    }
    if (data.cpf && data.cpf !== reg.payer_cpf) {
      await supabaseAdmin.rpc("set_registration_payer", {
        _id: reg.id,
        _cpf: cleanCpf,
        _postal_code: null as unknown as string,
        _payment_method: "pix",
        _installments: 1,
      });
    }

    const customer = await findOrCreateCustomer({
      name: reg.athlete1_name,
      email: reg.contact_email,
      phone: reg.contact_phone,
      cpfCnpj: cleanCpf,
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
          address: data.holderAddress,
          province: data.holderNeighborhood,
          city: data.holderCity,
          state: data.holderState.toUpperCase(),
          complement: data.holderComplement?.trim() || undefined,
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
      const { sendVoucherConfirmationEmail } = await import("./email/send-voucher.server");
      await sendVoucherConfirmationEmail(reg.id);
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

// Sandbox-only helper: marks a pending PIX as confirmed without real payment.
// Refuses to run when ASAAS_ENV=production.
export const simulatePayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ voucher: z.string().min(4).max(32) }).parse(input))
  .handler(async ({ data }) => {
    const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
    if (env === "production") {
      throw new Error("Simulação desabilitada em produção");
    }

    const voucher = data.voucher.toUpperCase();
    const { data: reg, error } = await supabaseAdmin
      .from("registrations")
      .select("id, status, asaas_payment_id, amount_cents")
      .eq("voucher_code", voucher)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reg) throw new Error("Inscrição não encontrada");
    if (reg.status === "confirmed") return { status: "confirmed" as const };

    // Preferred path: tell Asaas the payment was received in cash, which
    // updates the sandbox panel and triggers the PAYMENT_RECEIVED webhook
    // that confirms the registration through /api/public/asaas-webhook.
    if (reg.asaas_payment_id && !isAsaasMock()) {
      const { receivePaymentInCash } = await import("./asaas.server");
      try {
        await receivePaymentInCash({
          paymentId: reg.asaas_payment_id,
          valueCents: reg.amount_cents ?? 0,
        });
        return { status: "pending_webhook" as const };
      } catch (err: any) {
        // Fall through to local confirmation if Asaas refuses (e.g. already received)
        console.error("[simulatePayment] receiveInCash failed", err?.message);
      }
    }

    // Fallback: local confirmation (mock mode or no payment id yet).
    const paymentId = reg.asaas_payment_id ?? `SIMULATED_${reg.id}`;
    const { error: rpcErr } = await supabaseAdmin.rpc("confirm_registration_by_payment", {
      _payment_id: paymentId,
      _registration_id: reg.id,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const { sendVoucherConfirmationEmail } = await import("./email/send-voucher.server");
    await sendVoucherConfirmationEmail(reg.id);
    return { status: "confirmed" as const };
  });
