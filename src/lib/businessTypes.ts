import type { Json } from './database.types'
type Table<R> = { Row: R; Insert: never; Update: never; Relationships: [] }
type Audit = { id: string; created_at: string }
type Posted = Audit & { status: 'posted' | 'reversed'; notes: string | null; reversal_reason: string | null }
export type PayrollSlip = Posted & { run_id: string; employee_id: string; project_id: string | null; period: string; base_salary: number; allowances: number; deductions: number; advance_deduction: number; net_amount: number }
export type Equipment = Audit & { code: string; name: string; ownership: 'owned' | 'hired'; status: 'available' | 'maintenance' | 'inactive'; daily_rate: number; notes: string | null }
export type Rental = Posted & { equipment_id: string; project_id: string; supplier_id: string | null; purchase_id: string | null; start_date: string; end_date: string; quantity: number; daily_rate: number; agreed_amount: number; returned_on: string | null }
export type Product = Audit & { code: string; name: string; unit_id: string; minimum_quantity: number; is_active: boolean }
export type Warehouse = Audit & { name: string; location: string | null; is_active: boolean }
export type StockMovement = Posted & { sequence: number; product_id: string; warehouse_id: string; target_warehouse_id: string | null; project_id: string | null; purchase_id: string | null; source_movement_id: string | null; kind: string; quantity: number; unit_cost: number; total_cost: number; movement_date: string }
export type Advance = Posted & { employee_id: string; kind: 'advance' | 'repayment' | 'opening'; treasury_id: string | null; amount: number; entry_date: string }
export type PayrollPayment = Posted & { slip_id: string; treasury_id: string; amount: number; payment_date: string }
export type BusinessTables = {
 business_requests: Table<Audit & { action: string; payload: Json; result: string; created_by: string }>
 payroll_runs: Table<Audit & { period: string; notes: string | null }>
 payroll_slips: Table<PayrollSlip>
 payroll_payments: Table<PayrollPayment>
 employee_advances: Table<Advance>
 equipment: Table<Equipment>
 equipment_rentals: Table<Rental>
 warehouses: Table<Warehouse>
 stock_products: Table<Product>
 stock_movements: Table<StockMovement>
 stock_counts: Table<Audit & { product_id: string; warehouse_id: string; book_quantity: number; actual_quantity: number; movement_id: string | null; count_date: string; notes: string }>
}
export type BusinessViews = {
 employee_advance_balances: Table<{ employee_id: string; remaining: number }>
 payroll_balances: Table<PayrollSlip & { paid: number; remaining: number }>
 stock_balances: Table<{ product_id: string; warehouse_id: string; quantity: number; value: number; average_cost: number }>
 stock_ledger: Table<{ id: string; sequence: number; product_id: string; warehouse_id: string; movement_date: string; quantity: number; value: number }>
}
