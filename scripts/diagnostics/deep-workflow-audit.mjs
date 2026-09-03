/**
 * Read-only local behavioral audit. Executes functions extracted from the
 * current TypeScript source with an in-memory database double. No application
 * imports, network calls, real writes, or copies of the production formulas.
 * A failed expectation is an audit finding, not an end-to-end database result.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

const results = [];
function findNode(file, predicate) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (predicate(node, source)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (matches.length !== 1) throw new Error(`${file}: expected one source match, got ${matches.length}`);
  return { node: matches[0], source };
}
function executeFunction(node, source, bindings) {
  const js = ts.transpileModule(`const auditFunction = ${node.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return runInNewContext(`${js}\nauditFunction`, bindings, { timeout: 2000 });
}
function hookFunction(file, variable, hook, property, bindings) {
  const { node, source } = findNode(file, (n, s) =>
    ts.isVariableDeclaration(n) && n.name.getText(s).includes(variable) &&
    n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(s) === hook);
  const arg = node.initializer.arguments[0];
  const fn = property ? arg.properties.find(p => p.name?.getText(source) === property)?.initializer : arg;
  if (!fn) throw new Error(`Missing ${property}`);
  return executeFunction(fn, source, bindings);
}
function memoryDB(initial = {}, reject = () => null) {
  const tables = structuredClone(initial);
  const calls = [];
  const rpcCalls = [];
  const db = {
    from(table) {
      const q = { table, op: 'select', filters: [], single: false };
      const matches = row => q.filters.every(([key, operator, value]) => {
        const current = key.split('.').reduce((o, k) => o?.[k], row);
        return operator === 'in' ? value.includes(current) : current === value;
      });
      const chain = {
        select(columns) { q.columns = columns; return chain; },
        eq(key, value) { q.filters.push([key, 'eq', value]); return chain; },
        in(key, value) { q.filters.push([key, 'in', value]); return chain; },
        order() { return chain; },
        maybeSingle() { q.single = true; return chain; },
        single() { q.single = true; return chain; },
        insert(payload) { q.op = 'insert'; q.payload = payload; return chain; },
        update(payload) { q.op = 'update'; q.payload = payload; return chain; },
        delete() { q.op = 'delete'; return chain; },
        upsert(payload, options) { q.op = 'upsert'; q.payload = payload; q.options = options; return chain; },
        then(resolve, fail) {
          return Promise.resolve().then(() => {
            calls.push(structuredClone(q));
            const error = reject(q);
            if (error) return { data: null, error };
            tables[table] ??= [];
            let rows = tables[table].filter(matches);
            if (q.op === 'insert') {
              rows = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((r, i) => ({ id: `memory-${calls.length}-${i}`, ...r }));
              tables[table].push(...rows);
            } else if (q.op === 'delete') {
              tables[table] = tables[table].filter(row => !matches(row));
            } else if (q.op === 'update') {
              rows.forEach(row => Object.assign(row, q.payload));
            } else if (q.op === 'upsert') {
              const keys = q.options.onConflict.split(',');
              const existing = tables[table].find(row => keys.every(k => row[k] === q.payload[k]));
              if (existing) Object.assign(existing, q.payload);
              else tables[table].push({ id: `memory-${calls.length}`, ...q.payload });
            }
            return { data: q.single ? (rows[0] ?? null) : rows, error: null };
          }).then(resolve, fail);
        },
      };
      return chain;
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args: structuredClone(args) });
      return { data: { payment_id: `memory-rpc-${rpcCalls.length}` }, error: null };
    },
  };
  return { db, tables, calls, rpcCalls };
}
function expect(id, label, expected, actual) {
  results.push({ id, label, status: JSON.stringify(expected) === JSON.stringify(actual) ? 'PASS' : 'FAIL', expected, actual });
}

const moduleContext = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync('src/lib/financialCore.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, moduleContext, { timeout: 2000 });
const { calculateProjectFinancials } = moduleContext.exports;
const p = { id: 'project-a', client_id: 'client', project_type: 'contracting', budget: 3000 };
const summary = mock => hookFunction('src/hooks/useProjectFinancialSummary.ts', 'refetch', 'useQuery', 'queryFn', {
  projectId: p.id, supabase: mock.db, calculateProjectFinancials,
})();

// Positive control: the real core correctly handles a simple receipt.
const simple = calculateProjectFinancials({ project: p, clientPayments: [{ id: 'receipt', project_id: p.id, amount: 1000 }] });
expect('CTRL-1', 'Basic project receipt arithmetic', 2000, simple.clientRemaining);

const supplier = hookFunction('src/pages/SupplierDetail.tsx', 'globalPurchases', 'useMemo', null, {
  purchases: [], supplierPayments: [{ amount: 1000 }], supplierPaymentAllocations: [], directPurchasePayments: [],
})();
expect('D-01', 'Unallocated supplier advance remains visible', -1000, supplier.signedBalance);

const laborMock = memoryDB();
await hookFunction('src/components/technicians/forms/TechnicianLaborForm.tsx', 'saveMutation', 'useMutation', 'mutationFn', {
  supabase: laborMock.db, projectType: 'finishing', projectId: 'finishing-project', projectItemId: '',
  technicianId: 'tech', workDescription: 'Synthetic labor', notes: '', quantity: '6', rate: '200',
  calculatedEarnedAmount: 1200, date: '2026-09-02', effectivePhaseId: null, idempotencyKey: 'synthetic-only',
})();
expect('CTRL-2', 'Finishing labor writer records the entered value', 1200, laborMock.tables.purchases[0].total_amount);
const technician = hookFunction('src/pages/TechnicianDetail.tsx', 'globalWorkValue', 'useMemo', null, {
  assignments: [], technicianPayments: [], laborPayments: [], purchases: laborMock.tables.purchases,
})();
expect('D-02', 'Finishing labor is reflected in technician account', 1200, technician.globalWorkValue);

const techSummary = memoryDB({
  projects: [p],
  project_item_technicians: [{ id: 'assignment', total_cost: 3000, project_items: { project_id: p.id } }],
  technician_payments: [{ amount: 1000, status: 'completed', context_project_id: p.id }],
});
// Context is explicitly informational in the party-level payment architecture.
// Do not call missing project allocation a proven accounting error without a
// decision about how the still-visible project paid/remaining cards should work.
results.push({ id: 'D-03', label: 'Project paid card does not include party-level payments even with project context',
  status: 'REVIEW', enteredPartyPayment: 1000,
  projectPaidCard: (await summary(techSummary)).cashFlow.technicianPaid,
  reason: 'Define project attribution or label the project card as excluding party-level payments.' });

const supplierSummary = memoryDB({ projects: [p],
  purchases: [{ id: 'purchase', project_id: p.id, purchase_type: 'material', total_amount: 1000, paid_amount: 700 }],
  supplier_payment_allocations: [{ payment_id: 'supplier-payment', purchase_id: 'purchase', amount: 700 }],
});
expect('D-04', 'Project supplier remaining includes on-account allocations', 300, (await summary(supplierSummary)).cashFlow.supplierRemaining);

const creditSummary = memoryDB({ projects: [p],
  client_credit_ledger: [{ entry_type: 'CREDIT_APPLIED', target_project_id: p.id, amount: 500 }],
});
expect('D-05', 'Project summary includes applied credit from ledger', 2500, (await summary(creditSummary)).clientRemaining);

const failedIncome = memoryDB({}, q => q.table === 'income' ? { message: 'Synthetic income failure' } : null);
let receiptRejected = false;
try {
  await hookFunction('src/pages/ProjectPayments.tsx', 'saveReceiptMutation', 'useMutation', 'mutationFn', {
    supabase: failedIncome.db, activeProjectId: p.id, project: p,
  })({ amount: '100', date: '2026-09-02', treasury_id: 'treasury', payment_method: 'cash', receipt_number: '', notes: '' });
} catch { receiptRejected = true; }
expect('D-06', 'Income failure is reported instead of receipt success', true, receiptRejected);

const deletion = memoryDB({
  client_payments: [{ id: 'receipt-one', amount: 100, date: '2026-09-02' }],
  income: ['receipt-one', 'receipt-two'].map(reference_id => ({ reference_id, project_id: p.id, amount: 100, date: '2026-09-02', subtype: 'client_payment' })),
});
await hookFunction('src/pages/ProjectPayments.tsx', 'deleteMutation', 'useMutation', 'mutationFn', {
  supabase: deletion.db, activeProjectId: p.id,
})('receipt-one');
expect('D-07', 'Deleting one receipt preserves another same-day same-amount income', 1, deletion.tables.income.length);

const replay = memoryDB();
const payTech = hookFunction('src/pages/TechnicianDetail.tsx', 'payOnAccountMutation', 'useMutation', 'mutationFn', {
  supabase: replay.db, id: 'tech', payAmount: '100', payTreasuryId: 'treasury', payPaymentMethod: 'cash',
  payDate: '2026-09-02', payNotes: '', payReference: '', payContextProjectId: null, crypto: { randomUUID },
});
await payTech();
await payTech();
expect('D-08', 'Retry of unchanged payment intent reuses its idempotency key', true,
  replay.rpcCalls[0].args.p_idempotency_key === replay.rpcCalls[1].args.p_idempotency_key);

const client = hookFunction('src/pages/ClientDetail.tsx', 'clientFinancials', 'useMemo', null, {
  calculateProjectFinancials,
  projects: [{ ...p, budget: 1000 }, { ...p, id: 'project-b', budget: 500 }],
  phases: [], projectItems: [], purchases: [], contracts: [], clientExpenses: [], clientItemTechs: [],
  payments: [{ project_id: p.id, amount: 1500, projects: { project_type: 'contracting' } }],
})();
expect('D-09', 'Excess on project A does not silently settle project B', 500, client.remaining);

const bulk = memoryDB({
  project_item_technicians: [{ project_item_id: 'item', technician_id: 'tech', total_cost: 500 }],
  project_items: [{ id: 'item', project_id: p.id }],
}, q => q.table === 'project_items' && q.op === 'delete' ? { message: 'Synthetic deletion refusal' } : null);
try {
  await hookFunction('src/pages/ProjectItems.tsx', 'bulkDeleteItemsMutation', 'useMutation', 'mutationFn', {
    supabase: bulk.db, projectId: p.id,
  })(['item']);
} catch { /* The item deletion failed, so the existing assignment should survive. */ }
expect('D-10', 'Failed bulk item deletion preserves technician assignments', 1, bulk.tables.project_item_technicians.length);

const failedRead = memoryDB({ projects: [p] }, q => q.table === 'purchases' ? { message: 'Synthetic permission/network failure' } : null);
let summaryRejected = false;
try { await summary(failedRead); } catch { summaryRejected = true; }
expect('D-11', 'Summary refuses to show complete numbers when a source query fails', true, summaryRejected);

console.log(JSON.stringify({
  mode: 'LOCAL_SOURCE_FUNCTIONS_WITH_IN_MEMORY_DOUBLES', realDatabaseWrites: 0,
  passed: results.filter(r => r.status === 'PASS').length,
  failed: results.filter(r => r.status === 'FAIL').length,
  needsDesignReview: results.filter(r => r.status === 'REVIEW').length,
  results,
}, null, 2));
process.exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
