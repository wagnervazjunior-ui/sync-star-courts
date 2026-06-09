import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generateDoubleElim,
  evaluateMatch,
  type GeneratedMatch,
  type SourceRef,
} from "./brackets/generator";

async function assertCanManage(userId: string, championshipId: string) {
  const { data, error } = await supabaseAdmin.rpc("can_view_championship", {
    _user_id: userId,
    _championship_id: championshipId,
  });
  if (error) throw new Error(error.message);
  if (data) return; // admin/master tem acesso

  // Verificar se é árbitro com acesso a este campeonato
  const { data: refLink } = await (supabaseAdmin as any)
    .from("referee_championships")
    .select("referee_user_id")
    .eq("referee_user_id", userId)
    .eq("championship_id", championshipId)
    .maybeSingle();
  if (!refLink) throw new Error("CHAMPIONSHIP_NOT_ALLOWED");
}

function matchKey(phase: string, round: number, position: number) {
  return `${phase}-${round}-${position}`;
}

// ---------- LIST ----------
export const listBrackets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      championship_id: z.string().uuid().optional(),
      search: z.string().trim().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // Verificar se o usuário é árbitro (sem admin/master)
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData ?? []).map((r: any) => r.role);
    const isRefereeOnly = roles.includes("referee") && !roles.includes("admin") && !roles.includes("master");

    let q = supabaseAdmin
      .from("brackets")
      .select("id, name, championship_id, category_id, status, current_phase, match_format, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (isRefereeOnly) {
      // Árbitro: filtrar pelos campeonatos liberados a ele
      const { data: refChamps } = await (supabaseAdmin as any)
        .from("referee_championships")
        .select("championship_id")
        .eq("referee_user_id", userId);
      const ids = (refChamps ?? []).map((r: any) => r.championship_id);
      if (!ids.length) return { brackets: [], championships: [], categories: [] };
      if (data.championship_id && !ids.includes(data.championship_id)) throw new Error("CHAMPIONSHIP_NOT_ALLOWED");
      q = data.championship_id ? q.eq("championship_id", data.championship_id) : q.in("championship_id", ids);
    } else if (data.championship_id) {
      await assertCanManage(userId, data.championship_id);
      q = q.eq("championship_id", data.championship_id);
    } else {
      // restringir aos campeonatos visíveis
      const { data: chs, error: e1 } = await supabaseAdmin.rpc("list_manageable_championships");
      if (e1) throw new Error(e1.message);
      const ids = (chs ?? []).map((c: any) => c.id);
      if (!ids.length) return { brackets: [], championships: [], categories: [] };
      q = q.in("championship_id", ids);
    }
    const { data: brackets, error } = await q;
    if (error) throw new Error(error.message);

    const chIds = Array.from(new Set((brackets ?? []).map((b) => b.championship_id)));
    const catIds = Array.from(new Set((brackets ?? []).map((b) => b.category_id)));
    const [{ data: chs }, { data: cats }] = await Promise.all([
      chIds.length
        ? supabaseAdmin.from("championships").select("id, name, slug").in("id", chIds)
        : Promise.resolve({ data: [] as any[] }),
      catIds.length
        ? supabaseAdmin.from("categories").select("id, name, gender").in("id", catIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    let filtered = brackets ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter((b) => {
        const ch = (chs ?? []).find((c: any) => c.id === b.championship_id);
        const cat = (cats ?? []).find((c: any) => c.id === b.category_id);
        return (
          b.name.toLowerCase().includes(s) ||
          (ch?.name ?? "").toLowerCase().includes(s) ||
          (cat?.name ?? "").toLowerCase().includes(s)
        );
      });
    }

    return { brackets: filtered, championships: chs ?? [], categories: cats ?? [] };
  });

// ---------- Campeonatos acessíveis (admin OU árbitro) ----------
export const listAccessibleChampionships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: rolesData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesData ?? []).map((r: any) => r.role);
    const isRefereeOnly = roles.includes("referee") && !roles.includes("admin") && !roles.includes("master");

    if (isRefereeOnly) {
      const { data: refChamps } = await (supabaseAdmin as any)
        .from("referee_championships")
        .select("championship:championships(id, name, start_date)")
        .eq("referee_user_id", userId);
      const list = ((refChamps ?? []) as any[]).map((r) => r.championship).filter(Boolean);
      return { championships: list as Array<{ id: string; name: string; start_date: string | null }> };
    }

    const { data, error } = await context.supabase.rpc("list_manageable_championships");
    if (error) throw new Error(error.message);
    return { championships: (data ?? []) as Array<{ id: string; name: string; start_date: string | null }> };
  });

// ---------- CATEGORIES de um campeonato (com #confirmadas) ----------
export const listCategoriesForBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ championship_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context.userId, data.championship_id);
    const { data: cats, error } = await supabaseAdmin
      .from("categories")
      .select("id, name, gender, max_slots")
      .eq("championship_id", data.championship_id)
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    const ids = (cats ?? []).map((c) => c.id);
    if (!ids.length) return { categories: [] };
    const { data: regs } = await supabaseAdmin
      .from("registrations")
      .select("id, category_id, status")
      .in("category_id", ids)
      .eq("status", "confirmed");
    const counts: Record<string, number> = {};
    (regs ?? []).forEach((r) => {
      counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
    });
    return {
      categories: (cats ?? []).map((c) => ({ ...c, confirmed_count: counts[c.id] ?? 0 })),
    };
  });

// ---------- GET ----------
export const getBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: bracket, error } = await supabaseAdmin
      .from("brackets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bracket) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, bracket.championship_id);

    const [{ data: teams }, { data: matches }, { data: ch }, { data: cat }] = await Promise.all([
      supabaseAdmin.from("bracket_teams").select("*").eq("bracket_id", data.id).order("seed"),
      supabaseAdmin
        .from("bracket_matches")
        .select("*")
        .eq("bracket_id", data.id)
        .order("phase")
        .order("round")
        .order("position"),
      supabaseAdmin.from("championships").select("id, name, slug").eq("id", bracket.championship_id).maybeSingle(),
      supabaseAdmin.from("categories").select("id, name, gender").eq("id", bracket.category_id).maybeSingle(),
    ]);

    return { bracket, teams: teams ?? [], matches: matches ?? [], championship: ch, category: cat };
  });

// ---------- CREATE ----------
const CreateSchema = z.object({
  championship_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  match_format: z.enum(["single_set", "best_of_3_tiebreak"]),
  target_score: z.number().int().min(1).max(99).default(18),
  tiebreak_points: z.number().int().min(1).max(99).default(15),
  // optional: lista manual de duplas (para uso standalone). Se vazio, usa inscrições confirmadas.
  manual_teams: z
    .array(
      z.object({
        team_name: z.string().trim().max(120).optional().default(""),
        athlete1_name: z.string().trim().max(120).default(""),
        athlete2_name: z.string().trim().max(120).default(""),
      }),
    )
    .optional(),
});

export const createBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context.userId, data.championship_id);

    // Coletar duplas
    let teamsInput: Array<{
      team_name: string;
      athlete1_name: string;
      athlete2_name: string;
      registration_id: string | null;
    }> = [];

    if (data.manual_teams && data.manual_teams.length) {
      teamsInput = data.manual_teams.map((t) => ({
        team_name: t.team_name ?? "",
        athlete1_name: t.athlete1_name,
        athlete2_name: t.athlete2_name,
        registration_id: null,
      }));
    } else {
      const { data: regs, error } = await supabaseAdmin
        .from("registrations")
        .select("id, team_name, athlete1_name, athlete2_name, created_at")
        .eq("category_id", data.category_id)
        .eq("status", "confirmed")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      teamsInput = (regs ?? []).map((r) => ({
        team_name: r.team_name ?? "",
        athlete1_name: r.athlete1_name,
        athlete2_name: r.athlete2_name,
        registration_id: r.id,
      }));
    }

    if (teamsInput.length < 2) throw new Error("MIN_2_TEAMS");

    // Insert bracket
    const { data: bracket, error: bErr } = await supabaseAdmin
      .from("brackets")
      .insert({
        championship_id: data.championship_id,
        category_id: data.category_id,
        name: data.name,
        match_format: data.match_format,
        target_score: data.target_score,
        tiebreak_points: data.tiebreak_points,
        status: "live",
        current_phase: "double_elim",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (bErr) throw new Error(bErr.message);

    // Insert teams (seed = ordem)
    const teamRows = teamsInput.map((t, i) => ({
      bracket_id: bracket.id,
      seed: i + 1,
      team_name: t.team_name,
      athlete1_name: t.athlete1_name,
      athlete2_name: t.athlete2_name,
      registration_id: t.registration_id,
    }));
    const { data: insertedTeams, error: tErr } = await supabaseAdmin
      .from("bracket_teams")
      .insert(teamRows)
      .select("*");
    if (tErr) throw new Error(tErr.message);
    const teamsBySeed: Record<number, string> = {};
    (insertedTeams ?? []).forEach((t) => {
      teamsBySeed[t.seed] = t.id;
    });

    // Gerar estrutura
    const generated = generateDoubleElim(teamsInput.length);
    const resolveSource = (s: SourceRef): { team_id: string | null; source: any } => {
      if (!s) return { team_id: null, source: null };
      if (s.type === "seed") return { team_id: teamsBySeed[s.seed] ?? null, source: s };
      if (s.type === "bye") return { team_id: null, source: s };
      return { team_id: null, source: s };
    };

    const matchRows = generated.map((m) => {
      const a = resolveSource(m.source_a);
      const b = resolveSource(m.source_b);
      return {
        bracket_id: bracket.id,
        phase: m.phase,
        round: m.round,
        position: m.position,
        team_a_id: a.team_id,
        team_b_id: b.team_id,
        source_a: a.source,
        source_b: b.source,
        bye: m.bye,
      };
    });

    const { data: insertedMatches, error: mErr } = await supabaseAdmin
      .from("bracket_matches")
      .insert(matchRows)
      .select("*");
    if (mErr) throw new Error(mErr.message);

    // Auto-resolver BYEs (vencedor = lado não-bye) e propagar
    await propagateAutoByes(bracket.id);

    return { bracket_id: bracket.id };
  });

// ---------- RECORD MATCH RESULT ----------
const RecordSchema = z.object({
  match_id: z.string().uuid(),
  sets: z
    .array(z.object({ a: z.number().int().min(0).max(99), b: z.number().int().min(0).max(99) }))
    .min(1)
    .max(3),
});

export const recordMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RecordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: match, error } = await supabaseAdmin
      .from("bracket_matches")
      .select("*, bracket:brackets(id, championship_id, match_format, status)")
      .eq("id", data.match_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!match) throw new Error("MATCH_NOT_FOUND");
    const br: any = (match as any).bracket;
    await assertCanManage(context.userId, br.championship_id);

    if (!match.team_a_id || !match.team_b_id) throw new Error("MATCH_NOT_READY");

    const winnerSide = evaluateMatch(data.sets, br.match_format);
    if (!winnerSide) throw new Error("INVALID_RESULT");
    const winnerTeam = winnerSide === "a" ? match.team_a_id : match.team_b_id;
    const loserTeam = winnerSide === "a" ? match.team_b_id : match.team_a_id;

    const { error: uErr } = await supabaseAdmin
      .from("bracket_matches")
      .update({ sets: data.sets, winner_team_id: winnerTeam, played_at: new Date().toISOString() })
      .eq("id", match.id);
    if (uErr) throw new Error(uErr.message);

    await propagate(br.id, match.phase, match.round, match.position, winnerTeam, loserTeam);

    // Marcar perdedor como eliminado se for SEMI/FINAL/THIRD/LB-final
    // Eliminação real: 2 derrotas. Simplificação: aqui só registramos final_rank na fase final.
    await maybeFinalize(br.id);

    return { ok: true };
  });

// Propaga vencedor/perdedor para matches futuros cujo source_a/source_b referencia este match
async function propagate(
  bracketId: string,
  phase: string,
  round: number,
  position: number,
  winnerTeamId: string,
  loserTeamId: string,
) {
  const key = matchKey(phase, round, position);
  const { data: downstream, error } = await supabaseAdmin
    .from("bracket_matches")
    .select("*")
    .eq("bracket_id", bracketId);
  if (error) throw new Error(error.message);

  for (const m of downstream ?? []) {
    let teamA = m.team_a_id;
    let teamB = m.team_b_id;
    let changed = false;
    const refA: any = m.source_a;
    const refB: any = m.source_b;
    if (refA && refA.key === key) {
      if (refA.type === "winner_of") teamA = winnerTeamId;
      if (refA.type === "loser_of") teamA = loserTeamId;
      changed = true;
    }
    if (refB && refB.key === key) {
      if (refB.type === "winner_of") teamB = winnerTeamId;
      if (refB.type === "loser_of") teamB = loserTeamId;
      changed = true;
    }
    if (changed) {
      await supabaseAdmin
        .from("bracket_matches")
        .update({ team_a_id: teamA, team_b_id: teamB })
        .eq("id", m.id);
    }
  }
}

// Resolve automaticamente todos os BYEs (matches com bye=true ou um lado bye)
async function propagateAutoByes(bracketId: string) {
  // loop até estabilizar
  for (let i = 0; i < 30; i++) {
    const { data: matches } = await supabaseAdmin
      .from("bracket_matches")
      .select("*")
      .eq("bracket_id", bracketId)
      .is("winner_team_id", null);
    let progressed = false;
    for (const m of matches ?? []) {
      const refA: any = m.source_a;
      const refB: any = m.source_b;
      // Se um lado é bye e o outro tem time → vencedor = lado com time
      const aIsBye = refA?.type === "bye";
      const bIsBye = refB?.type === "bye";
      if ((aIsBye && m.team_b_id) || (bIsBye && m.team_a_id)) {
        const winner = aIsBye ? m.team_b_id : m.team_a_id;
        await supabaseAdmin
          .from("bracket_matches")
          .update({ winner_team_id: winner, bye: true, played_at: new Date().toISOString() })
          .eq("id", m.id);
        await propagate(bracketId, m.phase, m.round, m.position, winner!, "");
        progressed = true;
      }
    }
    if (!progressed) break;
  }
}

async function maybeFinalize(bracketId: string) {
  const { data: matches } = await supabaseAdmin
    .from("bracket_matches")
    .select("*")
    .eq("bracket_id", bracketId);
  const all = matches ?? [];
  const final = all.find((m) => m.phase === "FINAL");
  const third = all.find((m) => m.phase === "THIRD");
  if (final?.winner_team_id && third?.winner_team_id) {
    const champ = final.winner_team_id;
    const runner = final.team_a_id === champ ? final.team_b_id : final.team_a_id;
    const t3 = third.winner_team_id;
    const t4 = third.team_a_id === t3 ? third.team_b_id : third.team_a_id;
    await Promise.all([
      supabaseAdmin.from("bracket_teams").update({ final_rank: 1 }).eq("id", champ),
      runner ? supabaseAdmin.from("bracket_teams").update({ final_rank: 2 }).eq("id", runner) : Promise.resolve(),
      supabaseAdmin.from("bracket_teams").update({ final_rank: 3 }).eq("id", t3),
      t4 ? supabaseAdmin.from("bracket_teams").update({ final_rank: 4 }).eq("id", t4) : Promise.resolve(),
      supabaseAdmin.from("brackets").update({ status: "finished" }).eq("id", bracketId),
    ]);
    // Disparar notificações de premiação se categoria tiver has_prize=true
    const { triggerPrizeNotificationsForBracket } = await import("./prizes.functions");
    triggerPrizeNotificationsForBracket(bracketId).catch(console.error);
  }
}

// ---------- RESET MATCH ----------
export const resetMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ match_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: match } = await supabaseAdmin
      .from("bracket_matches")
      .select("*, bracket:brackets(championship_id)")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, (match as any).bracket.championship_id);
    await supabaseAdmin
      .from("bracket_matches")
      .update({ sets: [], winner_team_id: null, played_at: null })
      .eq("id", data.match_id);
    return { ok: true };
  });

// ---------- DELETE ----------
export const deleteBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: bracket } = await supabaseAdmin
      .from("brackets")
      .select("championship_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!bracket) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, bracket.championship_id);
    await supabaseAdmin.from("bracket_matches").delete().eq("bracket_id", data.id);
    await supabaseAdmin.from("bracket_teams").delete().eq("bracket_id", data.id);
    await supabaseAdmin.from("brackets").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- UPDATE TEAM (substituir dados de uma dupla existente) ----------
export const updateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      team_id: z.string().uuid(),
      team_name: z.string().trim().max(120).optional().default(""),
      athlete1_name: z.string().trim().min(1).max(120),
      athlete2_name: z.string().trim().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: team } = await supabaseAdmin
      .from("bracket_teams")
      .select("*, bracket:brackets(championship_id)")
      .eq("id", data.team_id)
      .maybeSingle();
    if (!team) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, (team as any).bracket.championship_id);
    const { error } = await supabaseAdmin
      .from("bracket_teams")
      .update({
        team_name: data.team_name,
        athlete1_name: data.athlete1_name,
        athlete2_name: data.athlete2_name,
      })
      .eq("id", data.team_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SWAP A ↔ B dentro da mesma partida ----------
export const swapWithinMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ match_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: match } = await supabaseAdmin
      .from("bracket_matches")
      .select("*, bracket:brackets(championship_id)")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, (match as any).bracket.championship_id);
    if (match.winner_team_id) throw new Error("MATCH_ALREADY_PLAYED");
    const { error } = await supabaseAdmin
      .from("bracket_matches")
      .update({ team_a_id: match.team_b_id, team_b_id: match.team_a_id })
      .eq("id", match.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- TOGGLE PUBLIC ----------
export const toggleBracketPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), public: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: bracket } = await supabaseAdmin
      .from("brackets")
      .select("championship_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!bracket) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, bracket.championship_id);
    const { error } = await supabaseAdmin
      .from("brackets")
      .update({ public: data.public } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- GET PUBLIC BRACKET (sem auth) ----------
export const getPublicBracket = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: bracket, error } = await supabaseAdmin
      .from("brackets")
      .select("*")
      .eq("id", data.id)
      .eq("public" as any, true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bracket) throw new Error("NOT_FOUND_OR_NOT_PUBLIC");

    const [{ data: teams }, { data: matches }, { data: ch }, { data: cat }] = await Promise.all([
      supabaseAdmin.from("bracket_teams").select("*").eq("bracket_id", data.id).order("seed"),
      supabaseAdmin.from("bracket_matches").select("*").eq("bracket_id", data.id).order("phase").order("round").order("position"),
      supabaseAdmin.from("championships").select("id, name, slug").eq("id", bracket.championship_id).maybeSingle(),
      supabaseAdmin.from("categories").select("id, name, gender").eq("id", bracket.category_id).maybeSingle(),
    ]);

    return { bracket, teams: teams ?? [], matches: matches ?? [], championship: ch, category: cat };
  });

// ---------- LIST PUBLIC BRACKETS OF A CHAMPIONSHIP ----------
export const listPublicBrackets = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ championship_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: brackets, error } = await supabaseAdmin
      .from("brackets")
      .select("id, name, status, category_id, championship_id")
      .eq("championship_id", data.championship_id)
      .eq("public" as any, true)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { brackets: brackets ?? [] };
  });

// ---------- ADD TEAM TO EXISTING BRACKET (manual, with justification) ----------
export const addTeamToBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      bracket_id: z.string().uuid(),
      team_name: z.string().trim().max(120).default(""),
      athlete1_name: z.string().trim().min(1).max(120),
      athlete2_name: z.string().trim().min(1).max(120),
      reason: z.enum(["cash", "sponsor", "courtesy", "other"]),
      note: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: bracket } = await supabaseAdmin
      .from("brackets")
      .select("championship_id")
      .eq("id", data.bracket_id)
      .maybeSingle();
    if (!bracket) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, bracket.championship_id);

    // Next available seed
    const { data: existing } = await supabaseAdmin
      .from("bracket_teams")
      .select("seed")
      .eq("bracket_id", data.bracket_id)
      .order("seed", { ascending: false })
      .limit(1);
    const nextSeed = ((existing?.[0]?.seed) ?? 0) + 1;

    // Insert team
    const { data: newTeam, error: tErr } = await supabaseAdmin
      .from("bracket_teams")
      .insert({
        bracket_id: data.bracket_id,
        seed: nextSeed,
        team_name: data.team_name,
        athlete1_name: data.athlete1_name,
        athlete2_name: data.athlete2_name,
        registration_id: null,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);

    // Try to fill first available BYE slot in unplayed matches
    const { data: matches } = await supabaseAdmin
      .from("bracket_matches")
      .select("id, team_a_id, team_b_id, source_a, source_b, winner_team_id")
      .eq("bracket_id", data.bracket_id)
      .is("winner_team_id", null)
      .order("round");

    let placed = false;
    for (const m of matches ?? []) {
      const srcA = m.source_a as any;
      const srcB = m.source_b as any;
      if (!m.team_a_id && (!srcA || srcA.type === "bye" || srcA.type === "seed")) {
        await supabaseAdmin.from("bracket_matches").update({ team_a_id: newTeam.id }).eq("id", m.id);
        placed = true;
        break;
      }
      if (!m.team_b_id && (!srcB || srcB.type === "bye" || srcB.type === "seed")) {
        await supabaseAdmin.from("bracket_matches").update({ team_b_id: newTeam.id }).eq("id", m.id);
        placed = true;
        break;
      }
    }

    return { ok: true, team_id: newTeam.id, placed };
  });

// ---------- SWAP entre dois slots de partidas diferentes ----------
// Só permitido em partidas sem resultado, e apenas em slots originados por seed
// (não por winner_of/loser_of), para não corromper a propagação.
export const swapMatchSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      match_a_id: z.string().uuid(),
      slot_a: z.enum(["a", "b"]),
      match_b_id: z.string().uuid(),
      slot_b: z.enum(["a", "b"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.match_a_id === data.match_b_id && data.slot_a === data.slot_b)
      throw new Error("SAME_SLOT");
    const { data: rows } = await supabaseAdmin
      .from("bracket_matches")
      .select("*, bracket:brackets(championship_id)")
      .in("id", [data.match_a_id, data.match_b_id]);
    const mA = rows?.find((r) => r.id === data.match_a_id);
    const mB = rows?.find((r) => r.id === data.match_b_id);
    if (!mA || !mB) throw new Error("NOT_FOUND");
    await assertCanManage(context.userId, (mA as any).bracket.championship_id);
    if (mA.winner_team_id || mB.winner_team_id) throw new Error("MATCH_ALREADY_PLAYED");
    const srcA = data.slot_a === "a" ? (mA.source_a as any) : (mA.source_b as any);
    const srcB = data.slot_b === "a" ? (mB.source_a as any) : (mB.source_b as any);
    const isSeedOrigin = (s: any) => !s || s.type === "seed" || s.type === "bye";
    if (!isSeedOrigin(srcA) || !isSeedOrigin(srcB))
      throw new Error("SLOT_FROM_PROPAGATION");
    const teamA = data.slot_a === "a" ? mA.team_a_id : mA.team_b_id;
    const teamB = data.slot_b === "a" ? mB.team_a_id : mB.team_b_id;
    const upd = async (m: any, slot: "a" | "b", newTeam: string | null) => {
      const patch: any = slot === "a" ? { team_a_id: newTeam } : { team_b_id: newTeam };
      await supabaseAdmin.from("bracket_matches").update(patch).eq("id", m.id);
    };
    await upd(mA, data.slot_a, teamB);
    await upd(mB, data.slot_b, teamA);
    return { ok: true };
  });
