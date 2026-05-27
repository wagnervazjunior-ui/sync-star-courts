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

// Helper: assert admin can manage a championship (master OR creator OR co-admin)
async function assertAdminCanManageChampionship(adminUserId: string, championshipId: string) {
  const { data, error } = await supabaseAdmin.rpc("can_view_championship", {
    _user_id: adminUserId,
    _championship_id: championshipId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("CHAMPIONSHIP_NOT_ALLOWED");
}

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
  token: z.string().min(1).optional().nullable(),
});

const CreateReimbSchema = z.object({
  championship_id: z.string().uuid(),
  category: z.enum(["alimentacao", "transporte", "passagem", "gasolina", "hospedagem", "outro"]),
  description: z.string().trim().max(500).optional().nullable(),
  amount_cents: z.number().int().positive().max(100_000_000),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receipt_path: z.string().max(500).optional().nullable(),
});

const UpsertFeeSchema = z.object({
  championship_id: z.string().uuid(),
  amount_cents: z.number().int().positive().max(100_000_000),
  description: z.string().trim().max(500).optional().nullable(),
  receipt_path: z.string().max(500).optional().nullable(),
});

const AdminUpsertFeeSchema = UpsertFeeSchema.extend({
  staff_id: z.string().uuid(),
});

// ---------- Public: invites ----------
export const getInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("staff_invites")
      .select("token, active, owner_admin_id, championship_id, championship:championships(id, name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !invite.active || !invite.championship_id) return { ok: false as const };
    return {
      ok: true as const,
      championship: (invite as any).championship as { id: string; name: string } | null,
    };
  });

async function linkStaffChampionship(staffId: string, championshipId: string) {
  // Ignore unique-violation errors; vínculo é idempotente
  await supabaseAdmin
    .from("staff_championships")
    .insert({ staff_id: staffId, championship_id: championshipId });
}

export const registerStaff = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RegisterSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("staff_invites")
      .select("owner_admin_id, active, championship_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !invite.active || !invite.championship_id) throw new Error("INVITE_INVALID");

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

    await linkStaffChampionship(inserted.id, invite.championship_id);

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
      .select("id, birthdate, owner_admin_id")
      .eq("cpf", cpf)
      .eq("birthdate", data.birthdate)
      .maybeSingle();
    if (!staff) throw new Error("INVALID_CREDENTIALS");

    // If logging in via invite link, link this staff to the championship
    if (data.token) {
      const { data: invite } = await supabaseAdmin
        .from("staff_invites")
        .select("owner_admin_id, active, championship_id")
        .eq("token", data.token)
        .maybeSingle();
      if (
        invite &&
        invite.active &&
        invite.championship_id &&
        invite.owner_admin_id === staff.owner_admin_id
      ) {
        await linkStaffChampionship(staff.id, invite.championship_id);
      }
    }

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
      .from("staff_championships")
      .select("championship:championships(id, name, start_date, end_date)")
      .eq("staff_id", context.staff.id);
    if (error) throw new Error(error.message);
    const list = (data ?? [])
      .map((r: any) => r.championship)
      .filter(Boolean)
      .sort((a: any, b: any) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
    return { championships: list };
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
    // Ensure the staff is linked to this championship
    const { data: link } = await supabaseAdmin
      .from("staff_championships")
      .select("id")
      .eq("staff_id", context.staff.id)
      .eq("championship_id", data.championship_id)
      .maybeSingle();
    if (!link) throw new Error("CHAMPIONSHIP_NOT_ALLOWED");

    const { error } = await supabaseAdmin.from("staff_reimbursements").insert({
      staff_id: context.staff.id,
      championship_id: data.championship_id,
      category: data.category,
      description: data.description?.trim() ?? "",
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

// ---------- Staff fees (cachê) ----------
export const listMyFees = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("staff_fees")
      .select(
        "id, amount_cents, description, receipt_path, status, paid_at, created_at, created_by_role, championship:championships(id, name)",
      )
      .eq("staff_id", context.staff.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { fees: data ?? [] };
  });

export const upsertMyFee = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => UpsertFeeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: link } = await supabaseAdmin
      .from("staff_championships")
      .select("id")
      .eq("staff_id", context.staff.id)
      .eq("championship_id", data.championship_id)
      .maybeSingle();
    if (!link) throw new Error("CHAMPIONSHIP_NOT_ALLOWED");

    // If fee exists and is paid, refuse edits from staff
    const { data: existing } = await supabaseAdmin
      .from("staff_fees")
      .select("id, status")
      .eq("staff_id", context.staff.id)
      .eq("championship_id", data.championship_id)
      .maybeSingle();
    if (existing && existing.status === "paid") throw new Error("FEE_LOCKED_PAID");

    if (existing) {
      const { error } = await supabaseAdmin
        .from("staff_fees")
        .update({
          amount_cents: data.amount_cents,
          description: data.description?.trim() ?? "",
          receipt_path: data.receipt_path ?? null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("staff_fees").insert({
        staff_id: context.staff.id,
        championship_id: data.championship_id,
        amount_cents: data.amount_cents,
        description: data.description?.trim() ?? "",
        receipt_path: data.receipt_path ?? null,
        created_by_role: "staff",
        created_by: context.staff.id,
      });
      if (error) {
        if (String(error.message).includes("staff_fees_staff_id_championship_id_key"))
          throw new Error("FEE_ALREADY_EXISTS");
        throw new Error(error.message);
      }
    }
    return { ok: true as const };
  });

export const getMyFeeReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireStaffAuth])
  .inputValidator((input: unknown) => z.object({ fee_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("staff_fees")
      .select("receipt_path, staff_id")
      .eq("id", data.fee_id)
      .maybeSingle();
    if (!row || row.staff_id !== context.staff.id) throw new Error("FORBIDDEN");
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

// ---------- Admin ----------
export const listManageableChampionships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_manageable_championships");
    if (error) throw new Error(error.message);
    return { championships: (data ?? []) as Array<{ id: string; name: string; start_date: string | null }> };
  });

export const createOrRotateStaffInviteForChampionship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ championship_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminCanManageChampionship(context.userId, data.championship_id);

    // Deactivate existing invites for this admin+championship
    await supabaseAdmin
      .from("staff_invites")
      .update({ active: false })
      .eq("owner_admin_id", context.userId)
      .eq("championship_id", data.championship_id);

    const slug = newSessionToken().slice(0, 20);
    const { error } = await supabaseAdmin.from("staff_invites").insert({
      owner_admin_id: context.userId,
      championship_id: data.championship_id,
      token: slug,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { token: slug };
  });

export const listStaffInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("staff_invites")
      .select("token, championship_id, created_at")
      .eq("owner_admin_id", context.userId)
      .eq("active", true)
      .not("championship_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invites: data ?? [] };
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

// ---------- Admin: fees ----------
const AdminListFeesInput = z.object({
  championship_id: z.string().uuid().optional().nullable(),
  status: z.enum(["pending", "paid"]).optional().nullable(),
});

export const adminListFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminListFeesInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let query = supabaseAdmin
      .from("staff_fees")
      .select(
        "id, amount_cents, description, receipt_path, status, paid_at, created_at, created_by_role, " +
          "staff:staffs!inner(id, name, cpf, pix_key_type, pix_key, owner_admin_id), " +
          "championship:championships!inner(id, name, created_by)",
      )
      .eq("staff.owner_admin_id", context.userId)
      .order("created_at", { ascending: false });

    if (data.championship_id) query = query.eq("championship_id", data.championship_id);
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { fees: rows ?? [] };
  });

export const adminUpsertFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminUpsertFeeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminCanManageChampionship(context.userId, data.championship_id);

    // Ensure staff belongs to this admin
    const { data: staff } = await supabaseAdmin
      .from("staffs")
      .select("id, owner_admin_id")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (!staff || staff.owner_admin_id !== context.userId) throw new Error("FORBIDDEN");

    // Auto-link staff to championship
    await linkStaffChampionship(staff.id, data.championship_id);

    const { data: existing } = await supabaseAdmin
      .from("staff_fees")
      .select("id")
      .eq("staff_id", data.staff_id)
      .eq("championship_id", data.championship_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("staff_fees")
        .update({
          amount_cents: data.amount_cents,
          description: data.description?.trim() ?? "",
          receipt_path: data.receipt_path ?? null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("staff_fees").insert({
        staff_id: data.staff_id,
        championship_id: data.championship_id,
        amount_cents: data.amount_cents,
        description: data.description?.trim() ?? "",
        receipt_path: data.receipt_path ?? null,
        created_by_role: "admin",
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const setFeeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "paid"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("staff_fees")
      .select("id, staff:staffs!inner(owner_admin_id)")
      .eq("id", data.id)
      .maybeSingle();
    const owner = (row as any)?.staff?.owner_admin_id;
    if (!row || owner !== context.userId) throw new Error("FORBIDDEN");

    const { error } = await supabaseAdmin
      .from("staff_fees")
      .update({
        status: data.status,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
        paid_by: data.status === "paid" ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getFeeReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fee_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("staff_fees")
      .select("receipt_path, staff:staffs!inner(owner_admin_id)")
      .eq("id", data.fee_id)
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

export const createAdminReceiptUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ filename: z.string().min(1).max(200), staff_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: staff } = await supabaseAdmin
      .from("staffs")
      .select("id, owner_admin_id")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (!staff || staff.owner_admin_id !== context.userId) throw new Error("FORBIDDEN");

    const safe = data.filename.replace(/[^\w.\-]/g, "_").slice(-100);
    const path = `${context.userId}/${staff.id}/${crypto.randomUUID()}_${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("staff-receipts")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL de upload");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// ---------- Admin: export consolidated Excel ----------
const ExportInput = z.object({
  championship_id: z.string().uuid().optional().nullable(),
});

export const exportStaffFinanceXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExportInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const ExcelJS = (await import("exceljs")).default;

    // Reimbursements
    let rq = supabaseAdmin
      .from("staff_reimbursements")
      .select(
        "amount_cents, status, staff_id, championship_id, " +
          "staff:staffs!inner(id, name, cpf, pix_key_type, pix_key, owner_admin_id), " +
          "championship:championships(id, name)",
      )
      .eq("staff.owner_admin_id", context.userId);
    if (data.championship_id) rq = rq.eq("championship_id", data.championship_id);
    const { data: reimbs, error: e1 } = await rq;
    if (e1) throw new Error(e1.message);

    // Fees
    let fq = supabaseAdmin
      .from("staff_fees")
      .select(
        "amount_cents, status, staff_id, championship_id, " +
          "staff:staffs!inner(id, name, cpf, pix_key_type, pix_key, owner_admin_id), " +
          "championship:championships(id, name)",
      )
      .eq("staff.owner_admin_id", context.userId);
    if (data.championship_id) fq = fq.eq("championship_id", data.championship_id);
    const { data: fees, error: e2 } = await fq;
    if (e2) throw new Error(e2.message);


    type Row = {
      staff_id: string;
      name: string;
      cpf: string;
      pix_key_type: string;
      pix_key: string;
      championships: Set<string>;
      reimb_paid: number;
      reimb_pending: number;
      fee: number;
      fee_status: string | null;
    };
    const map = new Map<string, Row>();
    const ensure = (s: any, ch: any): Row => {
      const id = s.id;
      let r = map.get(id);
      if (!r) {
        r = {
          staff_id: id,
          name: s.name,
          cpf: s.cpf,
          pix_key_type: s.pix_key_type,
          pix_key: s.pix_key,
          championships: new Set(),
          reimb_paid: 0,
          reimb_pending: 0,
          fee: 0,
          fee_status: null,
        };
        map.set(id, r);
      }
      if (ch?.name) r.championships.add(ch.name);
      return r;
    };

    for (const r of (reimbs ?? []) as any[]) {
      const row = ensure(r.staff, r.championship);
      if (r.status === "paid") row.reimb_paid += r.amount_cents;
      else row.reimb_pending += r.amount_cents;
    }
    for (const f of (fees ?? []) as any[]) {
      const row = ensure(f.staff, f.championship);
      row.fee += f.amount_cents;
      if (f.status === "paid") row.fee_status = "paid";
      else if (!row.fee_status) row.fee_status = "pending";
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Financeiro");
    ws.columns = [
      { header: "Staff", key: "name", width: 28 },
      { header: "CPF", key: "cpf", width: 16 },
      { header: "Tipo PIX", key: "pix_key_type", width: 12 },
      { header: "Chave PIX", key: "pix_key", width: 32 },
      { header: "Campeonato(s)", key: "champs", width: 30 },
      { header: "Reembolsos pagos", key: "reimb_paid", width: 18 },
      { header: "Reembolsos pendentes", key: "reimb_pending", width: 20 },
      { header: "Cachê", key: "fee", width: 14 },
      { header: "Status cachê", key: "fee_status", width: 14 },
      { header: "Total a pagar (pendentes + cachê)", key: "total_pay", width: 30 },
      { header: "Total geral", key: "total_all", width: 16 },
    ];
    ws.getRow(1).font = { bold: true };

    const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    rows.forEach((r) => {
      ws.addRow({
        name: r.name,
        cpf: r.cpf,
        pix_key_type: r.pix_key_type,
        pix_key: r.pix_key,
        champs: Array.from(r.championships).join(", "),
        reimb_paid: r.reimb_paid / 100,
        reimb_pending: r.reimb_pending / 100,
        fee: r.fee / 100,
        fee_status: r.fee_status === "paid" ? "Pago" : r.fee ? "Pendente" : "—",
        total_pay: (r.reimb_pending + (r.fee_status === "paid" ? 0 : r.fee)) / 100,
        total_all: (r.reimb_paid + r.reimb_pending + r.fee) / 100,
      });
    });

    const moneyFmt = '"R$" #,##0.00;[Red]("R$" #,##0.00);-';
    ["F", "G", "H", "J", "K"].forEach((col) => {
      ws.getColumn(col).numFmt = moneyFmt;
    });

    // Totals row
    const last = ws.rowCount;
    if (last >= 2) {
      const totalRow = ws.addRow({
        name: "TOTAL",
        reimb_paid: { formula: `SUM(F2:F${last})` },
        reimb_pending: { formula: `SUM(G2:G${last})` },
        fee: { formula: `SUM(H2:H${last})` },
        total_pay: { formula: `SUM(J2:J${last})` },
        total_all: { formula: `SUM(K2:K${last})` },
      });
      totalRow.font = { bold: true };
    }

    const buf = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buf as ArrayBuffer).toString("base64");
    const date = new Date().toISOString().slice(0, 10);
    return { filename: `financeiro-staff-${date}.xlsx`, base64 };
  });
