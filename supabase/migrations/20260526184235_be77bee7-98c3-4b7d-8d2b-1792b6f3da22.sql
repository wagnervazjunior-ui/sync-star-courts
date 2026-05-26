
ALTER PUBLICATION supabase_realtime DROP TABLE public.registrations;

DROP POLICY IF EXISTS championship_covers_public_read ON storage.objects;

ALTER FUNCTION public.generate_voucher_code() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE ALL ON FUNCTION public.get_registration_by_voucher(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_registration_by_voucher(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_registration(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_registration(jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_category_availability(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_category_availability(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.can_view_championship(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_championship(uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.can_create_championship(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_championship(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_admins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;

REVOKE ALL ON FUNCTION public.list_championship_admins(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_championship_admins(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_manageable_championships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_manageable_championships() TO authenticated;

REVOKE ALL ON FUNCTION public.dashboard_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.promote_user_to_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(text) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_admin_can_create(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_admin_can_create(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.grant_championship_admin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_championship_admin(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_championship_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_championship_admin(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_registration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_registration(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_registration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_registration(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_registration(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_registration(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_registration_payer(uuid, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_registration_payer(uuid, text, text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.set_registration_pix(uuid, text, text, text, text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_registration_pix(uuid, text, text, text, text, timestamptz, integer) TO service_role;

REVOKE ALL ON FUNCTION public.set_registration_processing(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_registration_processing(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_registration_by_payment(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_registration_by_payment(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_expired_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_expired_registrations() TO service_role;

REVOKE ALL ON FUNCTION public.set_championship_created_by() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_championship_created_by() TO authenticated;

DROP POLICY IF EXISTS registrations_no_direct_insert ON public.registrations;
CREATE POLICY registrations_no_direct_insert
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS registrations_no_direct_delete ON public.registrations;
CREATE POLICY registrations_no_direct_delete
ON public.registrations
FOR DELETE
TO anon, authenticated
USING (false);
