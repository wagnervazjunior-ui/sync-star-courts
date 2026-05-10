-- Permissão por admin: pode criar campeonatos
CREATE TABLE public.admin_permissions (
  user_id uuid PRIMARY KEY,
  can_create_championships boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_permissions_master_all ON public.admin_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));

CREATE POLICY admin_permissions_select_self ON public.admin_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'::public.app_role));

-- Função: pode criar campeonato?
CREATE OR REPLACE FUNCTION public.can_create_championship(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'master'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = _user_id AND can_create_championships = true
    );
$$;

-- Atualizar policy de insert: exigir permissão explícita
DROP POLICY IF EXISTS championships_admin_insert ON public.championships;
CREATE POLICY championships_admin_insert ON public.championships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND public.can_create_championship(auth.uid())
  );

-- RPC master-only para alternar a flag
CREATE OR REPLACE FUNCTION public.set_admin_can_create(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  INSERT INTO public.admin_permissions (user_id, can_create_championships, updated_by, updated_at)
  VALUES (_user_id, _value, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET can_create_championships = EXCLUDED.can_create_championships,
        updated_by = auth.uid(),
        updated_at = now();
END;
$$;

-- Atualizar list_admins para incluir can_create
DROP FUNCTION IF EXISTS public.list_admins();
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE(user_id uuid, email text, role public.app_role, created_at timestamptz, can_create boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, u.email::text, ur.role, ur.created_at,
         (ur.role = 'master'::public.app_role OR COALESCE(ap.can_create_championships, false)) AS can_create
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.admin_permissions ap ON ap.user_id = ur.user_id
  WHERE ur.role IN ('admin'::public.app_role, 'master'::public.app_role)
  ORDER BY ur.role DESC, ur.created_at ASC;
END;
$$;