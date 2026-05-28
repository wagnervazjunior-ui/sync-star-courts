import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const STAFF_COOKIE = "staff_session";
const SESSION_DAYS = 30;

export function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function buildSessionCookie(token: string, expiresAt: Date): string {
  const parts = [
    `${STAFF_COOKIE}=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${SESSION_DAYS * 24 * 3600}`,
  ];
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${STAFF_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function isValidCpf(raw: string): boolean {
  const c = normalizeCpf(raw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(c[i], 10) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9], 10) && calc(10) === parseInt(c[10], 10);
}

export async function loadStaffSession(token: string | undefined) {
  if (!token) return null;
  const { data: session } = await supabaseAdmin
    .from("staff_sessions")
    .select("token, staff_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("staff_sessions").delete().eq("token", token);
    return null;
  }
  const { data: staff } = await supabaseAdmin
    .from("staffs")
    .select("id, owner_admin_id, name, cpf, rg, birthdate, contact_email, contact_phone, pix_key_type, pix_key")
    .eq("id", session.staff_id)
    .maybeSingle();
  if (!staff) return null;
  return { staff, session };
}

export function newSessionToken(): string {
  const a = crypto.randomUUID().replace(/-/g, "");
  const b = crypto.randomUUID().replace(/-/g, "");
  return a + b;
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
}
