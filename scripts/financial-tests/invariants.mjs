import { supabase } from './client.mjs';

export async function runAllInvariants(harness) {
  console.log('\n--- EXECUTING AUTOMATED INVARIANTS (INV-01 to INV-24) ---');

  const { data: results, error } = await supabase.rpc('run_accounting_invariants_suite');

  if (error) {
    console.error('Error executing run_accounting_invariants_suite:', error);
    harness.assert('INV-ERR', 'Accounting Invariants RPC Execution', false, error.message, 'Success', 'Error');
    return;
  }

  for (const r of (results || [])) {
    harness.assert(
      r.id,
      r.name,
      r.status === 'PASS',
      r.details,
      r.expected,
      r.actual
    );
  }
}
