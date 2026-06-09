-- Track Asaas transfer IDs for staff payments
ALTER TABLE public.staff_fees
  ADD COLUMN IF NOT EXISTS asaas_transfer_id TEXT;

ALTER TABLE public.staff_reimbursements
  ADD COLUMN IF NOT EXISTS asaas_transfer_id TEXT;
