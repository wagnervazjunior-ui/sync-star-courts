CREATE OR REPLACE FUNCTION public.__debug_get_source(fn text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_get_functiondef(fn::regproc);
$$;
GRANT EXECUTE ON FUNCTION public.__debug_get_source(text) TO service_role;
