import { useCallback, useRef } from "react";
import { generateIdempotencyKey } from "@/lib/uuid";

/** Retain the same key across retries, including a lost response. */
export function useOperationKey() {
  const operation = useRef<{ signature: string; key: string } | null>(null);
  const getKey = useCallback((payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (operation.current?.signature !== signature) {
      operation.current = { signature, key: generateIdempotencyKey("operation") };
    }
    return operation.current.key;
  }, []);
  const reset = useCallback(() => { operation.current = null; }, []);
  return { getKey, reset };
}
