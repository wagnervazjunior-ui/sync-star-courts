DO $$
DECLARE
  v_new uuid;
BEGIN
  SELECT id INTO v_new FROM auth.users WHERE lower(email) = 'estacao.open23@gmail.com' LIMIT 1;
  IF v_new IS NULL THEN
    RAISE NOTICE 'User estacao.open23@gmail.com not found — skipping master role assignment. Run again after the user signs up.';
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_new, 'master'::public.app_role)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_new, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;

  DELETE FROM public.user_roles WHERE role = 'master'::public.app_role AND user_id <> v_new;

  INSERT INTO public.admin_permissions (user_id, can_create_championships)
    VALUES (v_new, true)
    ON CONFLICT (user_id) DO UPDATE SET can_create_championships = true, updated_at = now();
END $$;