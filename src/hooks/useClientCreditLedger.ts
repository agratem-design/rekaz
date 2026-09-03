import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useClientCreditLedger() {
  return useQuery({ queryKey: ["client-credit-ledger", "all"], queryFn: async () => {
    const { data, error } = await supabase.from("client_credit_ledger")
      .select("client_id, entry_type, amount, source_payment_id, target_project_id");
    if (error) throw error;
    return data || [];
  } });
}
