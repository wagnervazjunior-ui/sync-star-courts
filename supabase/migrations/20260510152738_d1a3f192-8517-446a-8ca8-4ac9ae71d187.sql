
REVOKE ALL ON FUNCTION public.list_manageable_championships() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_manageable_championships() TO authenticated;

REVOKE ALL ON FUNCTION public.release_expired_registrations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_registrations() TO service_role;
