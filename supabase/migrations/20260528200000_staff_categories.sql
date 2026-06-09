-- Staff categories table
CREATE TABLE public.staff_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_categories_owner ON public.staff_categories(owner_admin_id);

-- Add category_id to staffs
ALTER TABLE public.staffs ADD COLUMN category_id UUID REFERENCES public.staff_categories(id) ON DELETE SET NULL;
