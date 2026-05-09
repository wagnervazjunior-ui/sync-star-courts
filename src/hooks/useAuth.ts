import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
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
    if (!user) { setIsAdmin(false); setIsMaster(false); setRolesLoading(false); return; }
    setRolesLoading(true);
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r) => r.role);
        setIsAdmin(roles.includes("admin") || roles.includes("master" as any));
        setIsMaster(roles.includes("master" as any));
        setRolesLoading(false);
      });
  }, [user]);

  return { session, user, isAdmin, isMaster, loading, rolesLoading };
}
