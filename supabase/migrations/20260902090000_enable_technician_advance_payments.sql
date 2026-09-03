-- Enable technician advances for every supported RPC signature.
-- The hardened 8-argument overload previously rejected a zero due balance,
-- while the canonical 9-argument overload supports genuine on-account advances.

DROP FUNCTION IF EXISTS public.pay_technician_on_account_atomic(
  UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT
);

-- Keep older clients compatible while delegating to the canonical function.
CREATE OR REPLACE FUNCTION public.pay_technician_on_account_atomic(
  p_technician_id UUID,
  p_treasury_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.pay_technician_on_account_atomic(
    p_technician_id,
    p_treasury_id,
    p_amount,
    p_payment_method,
    p_date,
    p_notes,
    p_reference,
    p_idempotency_key,
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(
  UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_technician_on_account_atomic(
  UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT
) TO authenticated;
