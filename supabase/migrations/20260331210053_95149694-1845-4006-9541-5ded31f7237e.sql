
CREATE POLICY "Accountants can delete treasury_transactions"
  ON public.treasury_transactions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'accountant'::app_role));
