import { supabase } from './client.mjs';

export function createFixtures(runTag = 'AUTO-INV') {
  return {
    runTag,
    CLIENT_ID: 'e2e00001-0000-0000-0000-000000000001',
    SUPPLIER_ID: 'e2e00002-0000-0000-0000-000000000001',
    TECHNICIAN_ID: 'e2e00003-0000-0000-0000-000000000001',
    PROJ_A_ID: 'e2e00004-0000-0000-0000-000000000001',
    PROJ_B_ID: 'e2e00004-0000-0000-0000-000000000002',
    PHASE_A_ID: 'e2e00005-0000-0000-0000-000000000001',
    PHASE_B_ID: 'e2e00005-0000-0000-0000-000000000002',
    ITEM_A_ID: 'e2e00006-0000-0000-0000-000000000001',
    CONTRACT_A_ID: 'e2e00007-0000-0000-0000-000000000001',
    
    TREASURY_A: 'c504cce9-8bfd-4cda-8296-80febdec2432', // Main Cash
    TREASURY_B: 'ff7416dd-5295-4e55-bd52-2196eef9ec37', // Bank Account
    
    PAY_C1_ID: 'e2e00008-0000-0000-0000-000000000001',
    PAY_C2_ID: 'e2e00008-0000-0000-0000-000000000002',
    PUR_MAT_ID: 'e2e00009-0000-0000-0000-000000000001',
    PUR_B_ID: 'e2e00009-0000-0000-0000-000000000002',
    PUR_LAB_ID: 'e2e00009-0000-0000-0000-000000000003',
    PAY_S1_ID: 'e2e0000a-0000-0000-0000-000000000001',
    PAY_S2_ID: 'e2e0000a-0000-0000-0000-000000000002',
    PAY_SB_ID: 'e2e0000a-0000-0000-0000-000000000003',
    PAY_T1_ID: 'e2e0000a-0000-0000-0000-000000000004',
    PROG_T1_ID: 'e2e0000b-0000-0000-0000-000000000001',
    EXP_P1_ID: 'e2e0000c-0000-0000-0000-000000000001',
    EXP_GEN_ID: 'e2e0000c-0000-0000-0000-000000000002'
  };
}

export async function captureBaselineSnapshot() {
  const [
    { data: treasuries },
    { data: txs },
    { data: clients },
    { data: contracts },
    { data: clientPayments },
    { data: suppliers },
    { data: purchases },
    { data: purchasePayments },
    { data: technicians },
    { data: techRecords },
    { data: expenses },
    { data: projects }
  ] = await Promise.all([
    supabase.from('treasuries').select('*').eq('is_active', true).order('created_at'),
    supabase.from('treasury_transactions').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('contracts').select('*'),
    supabase.from('client_payments').select('*'),
    supabase.from('suppliers').select('*'),
    supabase.from('purchases').select('*'),
    supabase.from('purchase_payments').select('*'),
    supabase.from('technicians').select('*'),
    supabase.from('technician_progress_records').select('*'),
    supabase.from('expenses').select('*'),
    supabase.from('projects').select('*')
  ]);

  return {
    treasuries: (treasuries || []).map(t => ({ id: t.id, name: t.name, balance: Number(t.balance) })),
    totalTreasuryBalance: (treasuries || []).reduce((s, t) => s + Number(t.balance), 0),
    treasuryTxCount: (txs || []).length,
    clientsCount: (clients || []).length,
    contractsCount: (contracts || []).length,
    contractsTotal: (contracts || []).reduce((s, c) => s + Number(c.amount || 0), 0),
    clientPaymentsCount: (clientPayments || []).length,
    clientPaymentsTotal: (clientPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0),
    suppliersCount: (suppliers || []).length,
    purchasesCount: (purchases || []).length,
    purchasesTotal: (purchases || []).reduce((s, p) => s + Number(p.total_amount || 0), 0),
    purchasePaymentsCount: (purchasePayments || []).length,
    purchasePaymentsTotal: (purchasePayments || []).reduce((s, p) => s + Number(p.amount || 0), 0),
    techniciansCount: (technicians || []).length,
    technicianProgressTotal: (techRecords || []).reduce((s, r) => s + Number(r.earned_amount || 0), 0),
    expensesCount: (expenses || []).length,
    expensesTotal: (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0),
    projectsCount: (projects || []).length
  };
}
