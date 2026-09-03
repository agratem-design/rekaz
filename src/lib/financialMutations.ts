import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

/** Never fall back to independent writes: a missing migration must fail closed. */
export async function financialRpc<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("يلزم تطبيق تحديث قاعدة البيانات قبل تنفيذ هذه العملية. لم تُسجّل أي عملية بديلة.");
    }
    throw new Error(error.message || "تعذر إكمال العملية؛ بقيت بيانات النموذج لإعادة المحاولة.");
  }
  return data as T;
}

export function invalidateFinancialQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: query => /client|project|technician|supplier|payment|purchase|expense|income|credit|debt|treasur|financial/.test(String(query.queryKey[0])),
  });
}
