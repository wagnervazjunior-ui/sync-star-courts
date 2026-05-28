ALTER TABLE public.staff_championships
  ADD CONSTRAINT staff_championships_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staffs(id) ON DELETE CASCADE,
  ADD CONSTRAINT staff_championships_championship_id_fkey FOREIGN KEY (championship_id) REFERENCES public.championships(id) ON DELETE CASCADE;

ALTER TABLE public.staff_fees
  ADD CONSTRAINT staff_fees_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staffs(id) ON DELETE CASCADE,
  ADD CONSTRAINT staff_fees_championship_id_fkey FOREIGN KEY (championship_id) REFERENCES public.championships(id) ON DELETE CASCADE;

ALTER TABLE public.staff_invites
  ADD CONSTRAINT staff_invites_championship_id_fkey FOREIGN KEY (championship_id) REFERENCES public.championships(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';