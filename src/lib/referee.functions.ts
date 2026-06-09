import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function newToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

async function assertCanManageReferees(userId: string, championshipId: string) {
  const { data } = await supabaseAdmin.rpc("can_view_championship", {
    _user_id: userId,
    _championship_id: championshipId,
  });
  if (!data) throw new Error("CHAMPIONSHIP_NOT_ALLOWED");
}

// ---------- Public: validar convite ----------
export const getRefereeInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("referee_invites" as any)
      .select("token, active, championship_id, championship:championships(id, name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !(invite as any).active) return { ok: false as const };
    return {
      ok: true as const,
      championship: (invite as any).championship as { id: string; name: string },
    };
  });

// ---------- Public: cadastrar árbitro via convite ----------
export const registerReferee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      token: z.string().min(1),
      name: z.string().trim().min(2).max(120),
      email: z.string().email().max(200),
      password: z.string().min(6).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: invite } = await supabaseAdmin
      .from("referee_invites" as any)
      .select("championship_id, created_by, active")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !(invite as any).active) throw new Error("INVITE_INVALID");

    const chId = (invite as any).championship_id;
    const createdBy = (invite as any).created_by;

    // Verificar se e-mail já existe
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const alreadyExists = existing?.users?.find(
      (u) => u.email?.toLowerCase() === data.email.toLowerCase().trim(),
    );

    let userId: string;

    if (alreadyExists) {
      userId = alreadyExists.id;
    } else {
      const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email.toLowerCase().trim(),
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name },
      });
      if (authErr) throw new Error(authErr.message);
      userId = created.user.id;
    }

    // Conceder role referee (idempotente)
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "referee" as any)
      .maybeSingle();
    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "referee" as any });
    }

    // Vincular ao campeonato (idempotente)
    const { data: existingLink } = await (supabaseAdmin as any)
      .from("referee_championships")
      .select("referee_user_id")
      .eq("referee_user_id", userId)
      .eq("championship_id", chId)
      .maybeSingle();
    if (!existingLink) {
      await (supabaseAdmin as any)
        .from("referee_championships")
        .insert({ referee_user_id: userId, championship_id: chId, granted_by: createdBy });
    }

    return { ok: true as const };
  });

// ---------- Admin: gerar/rotacionar convite ----------
export const createOrRotateRefereeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ championship_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageReferees(context.userId, data.championship_id);

    // Desativa invites anteriores
    await (supabaseAdmin as any)
      .from("referee_invites")
      .update({ active: false })
      .eq("championship_id", data.championship_id)
      .eq("created_by", context.userId);

    const token = newToken();
    const { error } = await (supabaseAdmin as any).from("referee_invites").insert({
      token,
      championship_id: data.championship_id,
      created_by: context.userId,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

// ---------- Admin: listar convites ativos ----------
export const listRefereeInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ championship_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageReferees(context.userId, data.championship_id);
    const { data: rows } = await (supabaseAdmin as any)
      .from("referee_invites")
      .select("token, created_at")
      .eq("championship_id", data.championship_id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    return { invite: (rows ?? [])[0] ?? null };
  });

// ---------- Admin: listar árbitros de um campeonato ----------
export const listChampionshipReferees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ championship_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageReferees(context.userId, data.championship_id);
    const { data: rows } = await (supabaseAdmin as any)
      .from("referee_championships")
      .select("referee_user_id, granted_by, created_at")
      .eq("championship_id", data.championship_id);

    if (!rows?.length) return { referees: [] };

    // Buscar emails dos árbitros
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const userMap = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));

    return {
      referees: (rows as any[]).map((r) => ({
        user_id: r.referee_user_id,
        email: userMap.get(r.referee_user_id) ?? "—",
        created_at: r.created_at,
      })),
    };
  });

// ---------- Admin: revogar árbitro de um campeonato ----------
export const revokeRefereeFromChampionship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      referee_user_id: z.string().uuid(),
      championship_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageReferees(context.userId, data.championship_id);
    const { error } = await (supabaseAdmin as any)
      .from("referee_championships")
      .delete()
      .eq("referee_user_id", data.referee_user_id)
      .eq("championship_id", data.championship_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- Referee: listar seus campeonatos ----------
export const listMyRefereeChampionships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (supabaseAdmin as any)
      .from("referee_championships")
      .select("championship:championships(id, name, start_date, end_date, slug)")
      .eq("referee_user_id", context.userId);
    return {
      championships: ((data ?? []) as any[])
        .map((r) => r.championship)
        .filter(Boolean),
    };
  });
