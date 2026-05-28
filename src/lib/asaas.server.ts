// Wrapper around the Asaas REST API. Operates in MOCK mode when ASAAS_API_KEY
// is not configured, so the UI can be developed before the account exists.

const SANDBOX_BASE = "https://sandbox.asaas.com/api/v3";
const PROD_BASE = "https://api.asaas.com/v3";

export type AsaasCustomer = { id: string };
export type AsaasPixCharge = {
  id: string;
  invoiceUrl?: string;
  dueDate?: string;
};
export type PixQrCode = {
  encodedImage: string; // base64 PNG (no data: prefix)
  payload: string; // copia-e-cola
  expirationDate: string; // ISO timestamp
};

function getConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  const baseUrl = env === "production" ? PROD_BASE : SANDBOX_BASE;
  return { apiKey, baseUrl, mock: !apiKey };
}

export function isAsaasMock() {
  return !process.env.ASAAS_API_KEY;
}

async function asaasFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured");
  const headers: Record<string, string> = {
    access_token: apiKey,
    "Content-Type": "application/json",
    accept: "application/json",
    "User-Agent": "OpenSyncPay/1.0 (+https://sync-star-courts.lovable.app)",
    ...(init.headers as Record<string, string> | undefined),
  };
  const body = init.json !== undefined ? JSON.stringify(init.json) : init.body;
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Asaas ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function findOrCreateCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  if (isAsaasMock()) {
    return { id: `mock_cus_${Buffer.from(input.email).toString("hex").slice(0, 12)}` };
  }
  // Try to find by email first
  const found = await asaasFetch<{ data: (AsaasCustomer & { cpfCnpj?: string | null })[] }>(
    `/customers?email=${encodeURIComponent(input.email)}`,
  );
  const existing = found.data?.[0];
  if (existing) {
    // If we have a CPF and the existing customer is missing it (or differs), update.
    if (input.cpfCnpj && (!existing.cpfCnpj || existing.cpfCnpj.replace(/\D/g, "") !== input.cpfCnpj.replace(/\D/g, ""))) {
      await asaasFetch(`/customers/${existing.id}`, {
        method: "POST",
        json: {
          name: input.name,
          email: input.email,
          mobilePhone: input.phone,
          cpfCnpj: input.cpfCnpj,
          externalReference: input.externalReference,
        },
      });
    }
    return { id: existing.id };
  }
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    json: {
      name: input.name,
      email: input.email,
      mobilePhone: input.phone,
      cpfCnpj: input.cpfCnpj,
      externalReference: input.externalReference,
    },
  });
}

export async function createPixCharge(input: {
  customerId: string;
  valueCents: number;
  description: string;
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
}): Promise<AsaasPixCharge> {
  if (isAsaasMock()) {
    return { id: `mock_pay_${input.externalReference.slice(0, 8)}_${Date.now()}` };
  }
  return asaasFetch<AsaasPixCharge>("/payments", {
    method: "POST",
    json: {
      customer: input.customerId,
      billingType: "PIX",
      value: Number((input.valueCents / 100).toFixed(2)),
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    },
  });
}

export type AsaasCardCharge = {
  id: string;
  status: string; // PENDING | CONFIRMED | RECEIVED | AWAITING_RISK_ANALYSIS | etc.
  invoiceUrl?: string;
};

export async function createCreditCardCharge(input: {
  customerId: string;
  valueCents: number;
  description: string;
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
  installmentCount: number;
  remoteIp: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string; // MM
    expiryYear: string; // YYYY
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    address?: string;
    complement?: string;
    province?: string;
    city?: string;
    state?: string;
    phone?: string;
  };
}): Promise<AsaasCardCharge> {
  if (isAsaasMock()) {
    return {
      id: `mock_card_${input.externalReference.slice(0, 8)}_${Date.now()}`,
      status: "CONFIRMED",
    };
  }
  const value = Number((input.valueCents / 100).toFixed(2));
  const body: Record<string, unknown> = {
    customer: input.customerId,
    billingType: "CREDIT_CARD",
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
    remoteIp: input.remoteIp,
    creditCard: input.creditCard,
    creditCardHolderInfo: input.creditCardHolderInfo,
  };
  if (input.installmentCount > 1) {
    body.installmentCount = input.installmentCount;
    body.totalValue = value;
  } else {
    body.value = value;
  }
  return asaasFetch<AsaasCardCharge>("/payments", { method: "POST", json: body });
}

export async function getPixQrCode(paymentId: string): Promise<PixQrCode> {
  if (isAsaasMock()) {
    // 1x1 transparent PNG, plus a fake BR Code payload so the UI can render.
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    return {
      encodedImage: tinyPng,
      payload: `00020126360014BR.GOV.BCB.PIX0114MOCK${paymentId}5204000053039865802BR5913OPEN SYNC PAY6009SAO PAULO62070503***6304ABCD`,
      expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return asaasFetch<PixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export async function receivePaymentInCash(input: {
  paymentId: string;
  valueCents: number;
}): Promise<{ status: string }> {
  if (isAsaasMock()) {
    return { status: "RECEIVED_IN_CASH" };
  }
  const today = new Date().toISOString().slice(0, 10);
  return asaasFetch<{ status: string }>(`/payments/${input.paymentId}/receiveInCash`, {
    method: "POST",
    json: {
      paymentDate: today,
      value: Number((input.valueCents / 100).toFixed(2)),
      notifyCustomer: false,
    },
  });
}
