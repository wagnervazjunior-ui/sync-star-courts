import { createServerFn, createMiddleware } from "@tanstack/react-start";
import {
  getRequestHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  STAFF_COOKIE,
  buildSessionCookie,
  clearSessionCookie,
  isValidCpf,
  loadStaffSession,
  newSessionToken,
  normalizeCpf,
  parseCookies,
  sessionExpiry,
} from "./staff.server";

// ---------- Staff auth middleware ----------
const requireStaffAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const cookieHeader = getRequestHeader("cookie");
    const token = parseCookies(cookieHeader)[STAFF_COOKIE];
    const session = await loadStaffSession(token);
    if (!session) throw new Response("Unauthorized", { status: 401 });
    return next({ context: { staff: session.staff, sessionToken: session.session.token } });
  },
);

// ---------- Schemas ----------
const PixKeyType = z.enum(["cpf", "email", "phone", "random"]);

const PixSchema = z
  .object({
    pix_key_type: PixKeyType,
    pix_key: z.string().trim().min(1).max(200),
  })
  .refine(
    (v) => {
      const k = v.pix_key.trim();
      if (v.pix_key_type === "cpf") return /^\d{11}$/.test(k.replace(/\D/g, ""));
      if (v.pix_key_type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k);
      if (v.pix_key_type === "phone") return k.replace(/\D/g, "").length >= 10;
      if (v.pix_key_type === "random") return k.length >= 8;
      return false;
    },
    { message: "Chave PIX inválida para o tipo selecionado" },
  );

const RegisterSchema = z
  .object({
    token: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    cpf: z.string().min(11).max(14),
    rg: z.string().trim().min(3).max(30),
    birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    contact_email: z.string().email().max(200).optional().or(z.literal("")),
    contact_phone: z.string().max(30).optional().or(z.literal("")),
    pix_key_type: PixKeyType,
    pix_key: z.string().trim().min(1).max(200),
  })
  .superRefine((v, ctx) => {
    if (!isValidCpf(v.cpf)) {
      ctx.addIssue({ code: "custom", message: "CPF inválido", path: ["cpf"] });
    }
    const pix = PixSchema.safeParse({ pix_key_type: v.pix_key_type, pix_key: v.pix_key });
    if (!pix.success) {
      ctx.addIssue({ code: "custom", message: "Chave PIX inválida", path: ["pix_key"] });
    }
  });

const LoginSchema = z.object({
  cpf: z.string().min(11).max(14),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const CreateReimbSchema = z.object({
  championship_id: z.string().uuid(),
  category: z.enum(["alimentacao", "transporte", "passagem", "gasolina", "hospedagem", "outro"]),
  description: z.string().trim().min(1).max(500),
  amount_cents: z.number().int().positive().max(100_000_000),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receipt_path: z.string().max(500).optional().nullable(),
});

// ---------- Public: invites ----------
export const getInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("staff_invites")
      .select("token, active, owner_admin_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !invite.active) return { ok: false as const };
    return { ok: true as const };
  });

export const registerStaff = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RegisterSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("staff_invites")
      .select("owner_admin_id, active")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !invite.active) throw new Error("INVITE_INVALID");

    const cpf = normalizeCpf(data.cpf);

    const { data: existing } = await supabaseAdmin
      .from("staffs")
      .select("id")
      .eq("owner_admin_id", invite.owner_admin_id)
      .eq("cpf", cpf)
      .maybeSingle();
    if (existing) throw new Error("CPF_ALREADY_REGISTERED");

    const { data: inserted, error } = await supabaseAdmin
      .from("staffs")
      .insert({
        owner_admin_id: invite.owner_admin_id,
        name: data.name.trim(),
        cpf,
        rg: data.rg.trim(),
        birthdate: data.birthdate,
        contact_email: data.contact_email ? data.contact_email.toLowerCase() : null,
        contact_phone: data.contact_phone || null,
        pix_key_type: data.pix_key_type,
        pix_key: data.pix_key.trim(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Create session immediately
    const token = newSessionToken();
    const expiresAt = sessionExpiry();
    await supabaseAdmin.from("staff_sessions").insert({
      token,
      staff_id: inserted.id,
      expires_at: expiresAt.toISOString(),
    });
    setResponseHeader("Set-Cookie", buildSessionCookie(token, expiresAt));
    return { ok: true as const };
  });

// ---------- Public: login/logout ----------
export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginSchema.parse(input))
  .handler(async ({ data }) => {
    const cpf = normalizeCpf(data.cpf);
    const { data: staff } = await supabaseAdmin
      .from("staffs")
      .select("id, birthdate")
      .eq("cpf", cpf)
      .eq("birthdate", data.birthdate)
      .maybeSingle();
    if (!staff) throw new Error("INVALID_CREDENTIALS");

    const token = newSessionToken();
    const expiresAt = sessionExpiry();
    await supabaseAdmin.from("staff_sessions").insert({
      token,
      staff_id: staff.id,
      expires_at: expiresAt.toISOString(),
    });
    setResponseHeader("Set-Cookie", buildSessionCookie(token, expiresAt));
    return { ok: true as const };
  });

export const staffLogout = createServerFn({ method: "POST" }).handler(async () => {
  const cookieHeader = getRequestHeader("cookie");
  const token = parseCookies(cookieHeader)[STAFF_COOKIE];
  if (token) await supabaseAdmin.from("staff_sessions").delete().eq("token", token);
  setResponseHeader("Set-Cookie", clearSessionCookie());
  return { ok: true as const };
});

// ---------- Staff (authenticated) ----------
export const getStaffMe = createServerFn({ method: "POST" })
  .handler(async () => {
    const cookieHeader = getRequestHeader("cookie");
    const token = parseCookies(cookieHeader)[STAFF_COOKIE];
    const session = await loadStaffSession(token);
    if (!session) return { staff: null };
    return { staff: session.staff };
  });

export const updateStaffPix = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => PixSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("staffs")
      .update({ pix_key_type: data.pix_key_type, pix_key: data.pix_key.trim() })
      .eq("id", context.staff.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listStaffChampionships = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("championships")
      .select("id, name, start_date, end_date")
      .eq("created_by", context.staff.owner_admin_id)
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    return { championships: data ?? [] };
  });

export const listMyReimbursements = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("staff_reimbursements")
      .select(
        "id, category, description, amount_cents, expense_date, receipt_path, status, paid_at, created_at, championship:championships(id, name)",
      )
      .eq("staff_id", context.staff.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { reimbursements: data ?? [] };
  });

export const createReimbursement = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => CreateReimbSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Ensure championship belongs to staff's admin
    const { data: ch } = await supabaseAdmin
      .from("championships")
      .select("id, created_by")
      .eq("id", data.championship_id)
      .maybeSingle();
    if (!ch || ch.created_by !== context.staff.owner_admin_id) {
      throw new Error("CHAMPIONSHIP_NOT_ALLOWED");
    }

    const { error } = await supabaseAdmin.from("staff_reimbursements").insert({
      staff_id: context.staff.id,
      championship_id: data.championship_id,
      category: data.category,
      description: data.description.trim(),
      amount_cents: data.amount_cents,
      expense_date: data.expense_date,
      receipt_path: data.receipt_path || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const createReceiptUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) =>
    z.object({ filename: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/[^\w.\-]/g, "_").slice(-100);
    const path = `${context.staff.owner_admin_id}/${context.staff.id}/${crypto.randomUUID()}_${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("staff-receipts")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL de upload");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// ---------- Admin ----------
export const createOrRotateStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Deactivate existing invites
    await supabaseAdmin
      .from("staff_invites")
      .update({ active: false })
      .eq("owner_admin_id", context.userId);

    const slug = newSessionToken().slice(0, 20);
    const { error } = await supabaseAdmin.from("staff_invites").insert({
      owner_admin_id: context.userId,
      token: slug,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { token: slug };
  });

export const getStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("staff_invites")
      .select("token, created_at")
      .eq("owner_admin_id", context.userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { invite: data };
  });

export const listMyStaffs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("staffs")
      .select("id, name, cpf, rg, birthdate, contact_email, contact_phone, pix_key_type, pix_key, created_at")
      .eq("owner_admin_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { staffs: data ?? [] };
  });

const ListReimbInput = z.object({
  championship_id: z.string().uuid().optional().nullable(),
  status: z.enum(["pending", "paid"]).optional().nullable(),
});

export const adminListReimbursements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListReimbInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    // Build subquery: only championships of this admin
    let query = supabaseAdmin
      .from("staff_reimbursements")
      .select(
        "id, category, description, amount_cents, expense_date, receipt_path, status, paid_at, created_at, " +
          "staff:staffs!inner(id, name, cpf, pix_key_type, pix_key, owner_admin_id), " +
          "championship:championships!inner(id, name, created_by)",
      )
      .eq("staff.owner_admin_id", context.userId)
      .eq("championship.created_by", context.userId)
      .order("created_at", { ascending: false });

    if (data.championship_id) query = query.eq("championship_id", data.championship_id);
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { reimbursements: rows ?? [] };
  });

export const setReimbursementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["pending", "paid"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership: staff must belong to this admin
    const { data: row } = await supabaseAdmin
      .from("staff_reimbursements")
      .select("id, staff:staffs!inner(owner_admin_id)")
      .eq("id", data.id)
      .maybeSingle();
    const owner = (row as any)?.staff?.owner_admin_id;
    if (!row || owner !== context.userId) throw new Error("FORBIDDEN");

    const { error } = await supabaseAdmin
      .from("staff_reimbursements")
      .update({
        status: data.status,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
        paid_by: data.status === "paid" ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reimbursement_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("staff_reimbursements")
      .select("receipt_path, staff:staffs!inner(owner_admin_id)")
      .eq("id", data.reimbursement_id)
      .maybeSingle();
    const owner = (row as any)?.staff?.owner_admin_id;
    if (!row || owner !== context.userId) throw new Error("FORBIDDEN");
    if (!row.receipt_path) return { url: null as string | null };
    const { data: signed, error } = await supabaseAdmin.storage
      .from("staff-receipts")
      .createSignedUrl(row.receipt_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

export const getMyReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => z.object({ reimbursement_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("staff_reimbursements")
      .select("receipt_path, staff_id")
      .eq("id", data.reimbursement_id)
      .maybeSingle();
    if (!row || row.staff_id !== context.staff.id) throw new Error("FORBIDDEN");
    if (!row.receipt_path) return { url: null as string | null };
    const { data: signed, error } = await supabaseAdmin.storage
      .from("staff-receipts")
      .createSignedUrl(row.receipt_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });
