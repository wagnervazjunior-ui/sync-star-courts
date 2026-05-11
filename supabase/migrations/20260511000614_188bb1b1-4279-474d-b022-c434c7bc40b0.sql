CREATE OR REPLACE FUNCTION public.dashboard_stats(_championship_id uuid DEFAULT NULL)
RETURNS TABLE(
  total bigint,
  pending bigint,
  confirmed bigint,
  cancelled bigint,
  revenue_cents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _championship_id IS NULL THEN
    IF NOT public.has_role(auth.uid(), 'master'::public.app_role) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  ELSE
    IF NOT public.can_view_championship(auth.uid(), _championship_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE r.status = 'pending')::bigint AS pending,
    count(*) FILTER (WHERE r.status = 'confirmed')::bigint AS confirmed,
    count(*) FILTER (WHERE r.status = 'cancelled')::bigint AS cancelled,
    COALESCE(SUM(c.price_cents) FILTER (WHERE r.status = 'confirmed'), 0)::bigint AS revenue_cents
  FROM public.registrations r
  JOIN public.categories c ON c.id = r.category_id
  WHERE _championship_id IS NULL OR c.championship_id = _championship_id;
END;
$$;