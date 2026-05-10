import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [canCreateChampionships, setCanCreateChampionships] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsMaster(false); setCanCreateChampionships(false); setRolesLoading(false); return; }
    setRolesLoading(true);
    (async () => {
      const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (rolesData ?? []).map((r) => r.role);
      const master = roles.includes("master" as any);
      setIsAdmin(roles.includes("admin") || master);
      setIsMaster(master);
      if (master) {
        setCanCreateChampionships(true);
      } else {
        const { data: perm } = await supabase.from("admin_permissions" as any).select("can_create_championships").eq("user_id", user.id).maybeSingle();
        setCanCreateChampionships(!!(perm as any)?.can_create_championships);
      }
      setRolesLoading(false);
    })();
  }, [user]);

  return { session, user, isAdmin, isMaster, canCreateChampionships, loading, rolesLoading };
}
