-- Promote a user to admin by email (master only)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('user_id', v_user_id, 'email', _email);
END;
$$;

-- Revoke admin role (master only). Cannot revoke a master.
CREATE OR REPLACE FUNCTION public.revoke_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master'::public.app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF public.has_role(_user_id, 'master'::public.app_role) THEN
    RAISE EXCEPTION 'CANNOT_REVOKE_MASTER';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'admin'::public.app_role;
END;
$$;

-- List all admins/masters with email (admin or master can read)
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE(user_id uuid, email text, role public.app_role, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'master'::public.app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT ur.user_id, u.email::text, ur.role, ur.created_at
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role IN ('admin'::public.app_role, 'master'::public.app_role)
  ORDER BY ur.role DESC, ur.created_at ASC;
END;
$$;

-- Lock down EXECUTE
REVOKE EXECUTE ON FUNCTION public.promote_user_to_admin(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_admins() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;

-- Tighten user_roles policies: only master can write directly
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;

CREATE POLICY user_roles_master_all
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role));