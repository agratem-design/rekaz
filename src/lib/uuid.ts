/**
 * Safe UUID v4 generator with full cross-environment compatibility.
 * Works seamlessly in:
 * 1. Secure contexts (HTTPS, localhost) via globalThis.crypto.randomUUID()
 * 2. Non-secure LAN HTTP (e.g. http://192.168.10.144:8080) via crypto.getRandomValues()
 * 3. Fallback environments using high-resolution timer and pseudorandom entropy
 */
export function generateSafeUUID(): string {
  // Strategy 1: Native crypto.randomUUID (SecureContext)
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fall through to Strategy 2 if execution fails
    }
  }

  // Strategy 2: crypto.getRandomValues (available in almost all modern browsers, including non-secure LAN HTTP)
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    try {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);

      // Set version to 0100 (UUID v4)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // Set variant to 10xx (RFC4122)
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch {
      // Fall through to Strategy 3
    }
  }

  // Strategy 3: High-resolution timestamp + pseudorandom entropy
  let d = typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = r | 0;
    }
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Generate a canonical idempotency key for financial and operational transactions.
 */
export function generateIdempotencyKey(prefix = "req"): string {
  return `${prefix}_${generateSafeUUID()}`;
}
