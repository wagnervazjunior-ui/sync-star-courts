
INSERT INTO storage.buckets (id, name, public)
VALUES ('championship-covers', 'championship-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "championship_covers_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'championship-covers');

CREATE POLICY "championship_covers_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'championship-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "championship_covers_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'championship-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "championship_covers_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'championship-covers' AND public.has_role(auth.uid(), 'admin'));
