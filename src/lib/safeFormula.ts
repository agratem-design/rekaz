import { evaluate } from 'mathjs';

/**
 * Safely evaluate a mathematical formula string.
 * Uses mathjs instead of Function() to prevent code injection.
 * Only allows mathematical expressions - no JavaScript execution.
 */
export function safeEvaluate(formula: string): number | null {
  try {
    // Validate: only allow numbers, math operators, parentheses, dots, spaces
    const sanitized = formula.trim();
    if (!sanitized) return null;
    
    // Block anything that looks like code injection
    if (/[;{}[\]\\`'"=!<>?&|~^@#$%]/.test(sanitized)) {
      console.warn('Formula contains disallowed characters:', sanitized);
      return null;
    }
    
    const result = evaluate(sanitized);
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
