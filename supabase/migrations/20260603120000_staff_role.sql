-- Staff role: fixed function/area at the event (separate from custom staff_categories)
ALTER TABLE public.staffs ADD COLUMN IF NOT EXISTS staff_role TEXT;
