-- ========================================================
-- CLEAN PURGE SCRIPT FOR MANUAL USER ACCEPTANCE MODE
-- ========================================================

-- Disable triggers temporarily if needed, or truncate in cascading order
BEGIN;

-- 1. Purge all operational and financial child tables
DELETE FROM public.client_credit_ledger;
DELETE FROM public.client_payment_allocations;
DELETE FROM public.client_payments;
DELETE FROM public.purchase_payments;
DELETE FROM public.purchases;
DELETE FROM public.expenses;
DELETE FROM public.technician_progress_records;
DELETE FROM public.project_item_technicians;
DELETE FROM public.project_item_technician_requirements;
DELETE FROM public.project_items;
DELETE FROM public.general_item_technician_requirements;
DELETE FROM public.general_project_items;
DELETE FROM public.contract_items;
DELETE FROM public.contract_clauses;
DELETE FROM public.contracts;
DELETE FROM public.project_phases;
DELETE FROM public.project_technicians;
DELETE FROM public.project_suppliers;
DELETE FROM public.project_custody;
DELETE FROM public.project_schedules;
DELETE FROM public.checklist_items;
DELETE FROM public.inspection_checklists;
DELETE FROM public.risk_register;
DELETE FROM public.variation_orders;
DELETE FROM public.equipment_rentals;
DELETE FROM public.equipment;
DELETE FROM public.stock_movements;
DELETE FROM public.materials;
DELETE FROM public.transfers;
DELETE FROM public.treasury_transactions;
DELETE FROM public.treasury_debts;
DELETE FROM public.cash_flow_forecast;
DELETE FROM public.income;
DELETE FROM public.audit_logs;

-- 2. Purge parent business master records
DELETE FROM public.projects;
DELETE FROM public.clients;
DELETE FROM public.suppliers;
DELETE FROM public.technicians;
DELETE FROM public.engineers;
DELETE FROM public.employees;

-- 3. Clean any test fixture treasuries and preserve only the 3 canonical roots
DELETE FROM public.treasuries 
WHERE id NOT IN (
  'c504cce9-8bfd-4cda-8296-80febdec2432',
  'f9637060-3f26-445e-b77c-658b31da2269',
  'ff7416dd-5295-4e55-bd52-2196eef9ec37'
);

-- 4. Reset canonical treasuries stored balances to exactly 0.00
UPDATE public.treasuries 
SET balance = 0.00,
    updated_at = NOW()
WHERE id IN (
  'c504cce9-8bfd-4cda-8296-80febdec2432',
  'f9637060-3f26-445e-b77c-658b31da2269',
  'ff7416dd-5295-4e55-bd52-2196eef9ec37'
);

-- 5. Ensure company_settings points strictly to the legitimate canonical roots
UPDATE public.company_settings
SET contracting_treasury_id = 'c504cce9-8bfd-4cda-8296-80febdec2432',
    finishing_treasury_id = 'f9637060-3f26-445e-b77c-658b31da2269',
    updated_at = NOW();

COMMIT;
