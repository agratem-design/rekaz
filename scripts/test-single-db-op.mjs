import { supabase } from './financial-tests/client.mjs';

async function testSingle() {
  const clientRes = await supabase.from('clients').insert([{
    id: '00000000-0000-4000-a000-000000000001',
    name: 'Test Client',
    phone: '0910000000'
  }]);
  console.log('Client Insert:', clientRes.error || 'OK');

  const projRes = await supabase.from('projects').insert([{
    id: '00000000-0000-4000-a000-000000000002',
    name: 'Test Proj',
    client_id: '00000000-0000-4000-a000-000000000001',
    project_type: 'contracting'
  }]);
  console.log('Project Insert:', projRes.error || 'OK');

  const supRes = await supabase.from('suppliers').insert([{
    id: '00000000-0000-4000-a000-000000000004',
    name: 'Test Supplier'
  }]);
  console.log('Supplier Insert:', supRes.error || 'OK');

  const purRes = await supabase.from('purchases').insert([{
    id: '00000000-0000-4000-a000-000000000010',
    project_id: '00000000-0000-4000-a000-000000000002',
    supplier_id: '00000000-0000-4000-a000-000000000004',
    total_amount: 10000,
    paid_amount: 0,
    status: 'due',
    purchase_type: 'material',
    date: '2026-08-17'
  }]);
  console.log('Purchase Insert:', purRes.error || 'OK');

  // Clean up
  await supabase.from('purchases').delete().eq('id', '00000000-0000-4000-a000-000000000010');
  await supabase.from('projects').delete().eq('id', '00000000-0000-4000-a000-000000000002');
  await supabase.from('clients').delete().eq('id', '00000000-0000-4000-a000-000000000001');
  await supabase.from('suppliers').delete().eq('id', '00000000-0000-4000-a000-000000000004');
}

testSingle();
