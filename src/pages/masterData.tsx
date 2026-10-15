import { Banknote, HardHat, LayoutGrid, Printer, Ruler, Shapes, Tags, Truck, UserCog, Users, Wallet, Wrench } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { CrudPage, type CrudConfig, type Row } from '@/components/CrudPage'
import { Badge, Button, Money, StatCard } from '@/components/ui'
import { formatMoney } from '@/lib/format'
import { options, rateUnitLabels } from '@/lib/labels'
import type { AppRole } from '@/lib/supabase'
import { openPrint } from '@/print/open'
import { useBalanceMap, useClientBalanceMap } from './clients/clientData'

function ClientStats({ rows }: { rows: Row[] }) {
  const { hasRole } = useAuth()
  const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0)
  if (!hasRole('admin', 'accountant'))
    return (
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Users} label="عدد الزبائن" value={<span className="num">{rows.length}</span>} />
      </div>
    )
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      <StatCard icon={Users} label="عدد الزبائن" value={<span className="num">{rows.length}</span>} />
      <StatCard icon={Banknote} label="المقبوض من الزبائن" value={<Money value={sum('total_collected')} />} tone="blue" />
      <StatCard icon={Wallet} label="الذمم المستحقة" value={<Money value={sum('total_due')} />} tone="red" hint="المتبقي على المشاريع غير المسددة" />
      <StatCard icon={Wallet} label="أرصدة دائنة وزيادات" value={<Money value={sum('available_credit') + sum('total_overpaid_on_projects')} />} tone="sand" />
    </div>
  )
}

function PrintAllClients() {
  const { hasRole } = useAuth()
  if (!hasRole('admin', 'accountant')) return null
  return (
    <Button variant="secondary" onClick={() => openPrint('clients-statement', 'all')}>
      <Printer className="size-4" />
      طباعة الكشف الإجمالي
    </Button>
  )
}

const FIN: AppRole[] = ['admin', 'accountant']
const ADMIN: AppRole[] = ['admin']
const SITE_WRITE: AppRole[] = ['admin', 'accountant', 'engineer', 'supervisor']
const CATALOG: AppRole[] = ['admin', 'supervisor']

const contact = (section = 'بيانات التواصل') => [
  { key: 'phone', label: 'الهاتف', type: 'tel' as const, section },
  { key: 'email', label: 'البريد', type: 'email' as const, section },
  { key: 'address', label: 'العنوان', section },
]

const active = {
  key: 'is_active',
  label: 'الحالة',
  render: (r: Row) =>
    r.is_active ? (
      <Badge tone="green" dot>
        نشط
      </Badge>
    ) : (
      <Badge dot>موقوف</Badge>
    ),
}

const phone = { key: 'phone', label: 'الهاتف', hideBelow: 'sm' as const, render: (r: Row) => (r.phone ? <span className="num">{String(r.phone)}</span> : <span className="text-faint">—</span>) }

export const configs: Record<string, CrudConfig> = {
  clients: {
    table: 'clients',
    title: 'الزبائن',
    singular: 'زبون',
    description: 'دليل الزبائن. افتح الزبون لعرض كشف حسابه لكل مشروع.',
    icon: Users,
    avatar: true,
    columns: [
      { key: 'name', label: 'الاسم' },
      phone,
      { key: 'city', label: 'المدينة', hideBelow: 'lg' },
      { key: 'total_obligation', label: 'إجمالي الأعمال', align: 'end', hideBelow: 'md', render: (r) => (r.total_obligation === undefined ? <span className="text-faint">—</span> : <Money value={r.total_obligation as number} />) },
      { key: 'total_collected', label: 'المسدد', align: 'end', hideBelow: 'sm', render: (r) => (r.total_collected === undefined ? <span className="text-faint">—</span> : <Money value={r.total_collected as number} />) },
      {
        key: 'total_due',
        label: 'المتبقي',
        align: 'end',
        render: (r) =>
          r.total_due === undefined ? (
            <span className="text-faint">—</span>
          ) : (
            <span className="inline-flex flex-col items-end">
              <Money value={r.total_due as number} className={Number(r.total_due) > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted'} />
              {Number(r.available_credit) > 0 && <span className="text-[10px] text-sand-600">رصيد دائن {formatMoney(r.available_credit as number)}</span>}
              {Number(r.total_overpaid_on_projects) > 0 && <span className="text-[10px] text-sand-600">زيادة مدفوعة {formatMoney(r.total_overpaid_on_projects as number)}</span>}
            </span>
          ),
      },
    ],
    useExtra: useClientBalanceMap,
    stats: (rows) => <ClientStats rows={rows} />,
    headerActions: <PrintAllClients />,
    fields: [
      { key: 'name', label: 'اسم الزبون', required: true, section: 'البيانات الأساسية', placeholder: 'الاسم الكامل أو اسم الجهة' },
      { key: 'city', label: 'المدينة', section: 'البيانات الأساسية' },
      ...contact(),
      { key: 'notes', label: 'ملاحظات', type: 'textarea', section: 'ملاحظات' },
    ],
    writeRoles: FIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'phone', 'city'],
    detailPath: (r) => `/clients/${r.id}`,
  },
  suppliers: {
    table: 'suppliers',
    title: 'الموردون',
    singular: 'مورد',
    icon: Truck,
    avatar: true,
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'category', label: 'المجال', hideBelow: 'md' },
      phone,
      { key: 'invoiced', label: 'الفواتير', align: 'end', hideBelow: 'md', render: (r) => (r.invoiced === undefined ? <span className="text-faint">—</span> : <Money value={Number(r.invoiced) - Number(r.returned ?? 0)} />) },
      { key: 'paid', label: 'المدفوع', align: 'end', hideBelow: 'sm', render: (r) => (r.paid === undefined ? <span className="text-faint">—</span> : <Money value={r.paid as number} />) },
      {
        key: 'balance_due',
        label: 'المستحق',
        align: 'end',
        render: (r) =>
          r.balance_due === undefined ? (
            <span className="text-faint">—</span>
          ) : (
            <span className="inline-flex flex-col items-end">
              <Money value={Math.max(Number(r.balance_due), 0)} className={Number(r.balance_due) > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted'} />
              {Number(r.unallocated_advance) > 0 && <span className="text-[10px] text-sand-600">مقدم {formatMoney(r.unallocated_advance as number)}</span>}
            </span>
          ),
      },
    ],
    useExtra: () => useBalanceMap('supplier_balances', 'supplier_id'),
    detailPath: (r) => `/suppliers/${r.id}`,
    fields: [
      { key: 'name', label: 'اسم المورد', required: true, section: 'البيانات الأساسية' },
      { key: 'category', label: 'المجال', hint: 'مثل: حديد، إسمنت، كهرباء', section: 'البيانات الأساسية' },
      ...contact(),
      { key: 'notes', label: 'ملاحظات', type: 'textarea', section: 'ملاحظات' },
    ],
    writeRoles: FIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'phone', 'category'],
  },
  technicians: {
    table: 'technicians',
    title: 'الفنيون',
    singular: 'فني',
    icon: Wrench,
    avatar: true,
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'technician_type_id', label: 'التخصص', render: (r, lk) => lk.technician_types?.get(r.technician_type_id as string) ?? <span className="text-faint">—</span> },
      phone,
      {
        key: 'default_rate',
        label: 'السعر الافتراضي',
        align: 'end',
        hideBelow: 'md',
        render: (r) =>
          r.default_rate ? (
            <span className="whitespace-nowrap">
              <Money value={r.default_rate as number} /> <span className="text-xs text-muted">{rateUnitLabels[r.default_rate_unit as keyof typeof rateUnitLabels] ?? ''}</span>
            </span>
          ) : (
            <span className="text-faint">—</span>
          ),
      },
      {
        key: 'balance_due',
        label: 'المتبقي للفني',
        align: 'end',
        hideBelow: 'sm',
        render: (r) =>
          r.balance_due === undefined ? (
            <span className="text-faint">—</span>
          ) : Number(r.balance_due) < 0 ? (
            <span className="inline-flex flex-col items-end">
              <Money value={-Number(r.balance_due)} className="text-sand-600" />
              <span className="text-[10px] text-sand-600">مقدم عنده</span>
            </span>
          ) : (
            <Money value={r.balance_due as number} className={Number(r.balance_due) > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted'} />
          ),
      },
      active,
    ],
    useExtra: () => useBalanceMap('technician_balances', 'technician_id'),
    detailPath: (r) => `/technicians/${r.id}`,
    fields: [
      { key: 'name', label: 'اسم الفني', required: true, section: 'البيانات الأساسية' },
      { key: 'technician_type_id', label: 'التخصص', lookup: 'technician_types', section: 'البيانات الأساسية' },
      { key: 'phone', label: 'الهاتف', type: 'tel', section: 'البيانات الأساسية' },
      { key: 'default_rate', label: 'السعر الافتراضي (د.ل)', type: 'number', section: 'التسعير' },
      { key: 'default_rate_unit', label: 'طريقة الحساب', type: 'select', options: options(rateUnitLabels), section: 'التسعير' },
      { key: 'is_active', label: 'نشط', type: 'checkbox', section: 'الحالة' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', section: 'الحالة' },
    ],
    defaults: { is_active: true },
    writeRoles: SITE_WRITE,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'phone'],
  },
  employees: {
    table: 'employees',
    title: 'الموظفون',
    singular: 'موظف',
    icon: UserCog,
    avatar: true,
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'position', label: 'الوظيفة' },
      { key: 'department', label: 'القسم', hideBelow: 'md' },
      { key: 'base_salary', label: 'الراتب الأساسي', align: 'end', render: (r) => <Money value={r.base_salary as number} /> },
      active,
    ],
    fields: [
      { key: 'name', label: 'اسم الموظف', required: true, section: 'البيانات الوظيفية' },
      { key: 'position', label: 'الوظيفة', section: 'البيانات الوظيفية' },
      { key: 'department', label: 'القسم', section: 'البيانات الوظيفية' },
      { key: 'base_salary', label: 'الراتب الأساسي (د.ل)', type: 'number', section: 'البيانات الوظيفية' },
      { key: 'hire_date', label: 'تاريخ التعيين', type: 'date', section: 'البيانات الوظيفية' },
      { key: 'phone', label: 'الهاتف', type: 'tel', section: 'بيانات التواصل' },
      { key: 'email', label: 'البريد', type: 'email', section: 'بيانات التواصل' },
      { key: 'is_active', label: 'على رأس العمل', type: 'checkbox', section: 'الحالة' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', section: 'الحالة' },
    ],
    defaults: { is_active: true, base_salary: 0 },
    writeRoles: FIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'position', 'department'],
  },
  engineers: {
    table: 'engineers',
    title: 'المهندسون',
    singular: 'مهندس',
    icon: HardHat,
    avatar: true,
    columns: [{ key: 'name', label: 'الاسم' }, { key: 'specialty', label: 'التخصص' }, phone],
    fields: [
      { key: 'name', label: 'اسم المهندس', required: true, section: 'البيانات المهنية' },
      { key: 'specialty', label: 'التخصص', section: 'البيانات المهنية' },
      { key: 'license_number', label: 'رقم القيد', section: 'البيانات المهنية' },
      { key: 'phone', label: 'الهاتف', type: 'tel', section: 'بيانات التواصل' },
      { key: 'email', label: 'البريد', type: 'email', section: 'بيانات التواصل' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea', section: 'بيانات التواصل' },
    ],
    writeRoles: ADMIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'specialty'],
  },
  technician_types: {
    table: 'technician_types',
    title: 'تخصصات الفنيين',
    singular: 'تخصص',
    description: 'القائمة الوحيدة لتخصصات الفنيين في كل المنظومة. التخصص غير المستخدم يُوقف ولا يُحذف حفاظاً على السجل.',
    icon: Shapes,
    columns: [{ key: 'name', label: 'التخصص' }, { key: 'code', label: 'الرمز', render: (r) => <span className="num text-xs text-muted">{String(r.code ?? '')}</span> }, active],
    fields: [
      { key: 'name', label: 'التخصص', required: true },
      { key: 'code', label: 'الرمز', required: true, hint: 'حروف إنجليزية بلا مسافات، مثل: tiler' },
      { key: 'is_active', label: 'مستخدم', type: 'checkbox' },
    ],
    defaults: { is_active: true },
    writeRoles: ADMIN,
  },
  expense_categories: {
    table: 'expense_categories',
    title: 'فئات المصروفات',
    singular: 'فئة',
    description: 'الفئة غير المستخدمة تُوقف ولا تُحذف حفاظاً على السجل.',
    icon: Tags,
    columns: [{ key: 'name', label: 'الفئة' }, active],
    fields: [
      { key: 'name', label: 'الفئة', required: true },
      { key: 'is_active', label: 'مستخدمة', type: 'checkbox' },
    ],
    defaults: { is_active: true },
    writeRoles: FIN,
  },
  measurement_units: {
    table: 'measurement_units',
    title: 'وحدات القياس',
    singular: 'وحدة',
    icon: Ruler,
    columns: [
      { key: 'name', label: 'الوحدة' },
      { key: 'symbol', label: 'الرمز' },
    ],
    fields: [
      { key: 'name', label: 'الوحدة', required: true },
      { key: 'symbol', label: 'الرمز', required: true },
    ],
    writeRoles: CATALOG,
    deleteRoles: ADMIN,
  },
  catalog_items: {
    table: 'catalog_items',
    title: 'البنود العامة',
    singular: 'بند',
    description: 'بنود جاهزة تُستورد إلى مقايسة المشروع بسعرها ووحدتها.',
    icon: LayoutGrid,
    columns: [
      { key: 'name', label: 'البند' },
      { key: 'category', label: 'الفئة', hideBelow: 'md' },
      { key: 'unit_id', label: 'الوحدة', render: (r, lk) => lk.measurement_units?.get(r.unit_id as string) ?? <span className="text-faint">—</span> },
      { key: 'default_unit_price', label: 'سعر الوحدة', align: 'end', render: (r) => (r.default_unit_price ? <Money value={r.default_unit_price as number} /> : <span className="text-faint">—</span>) },
      active,
    ],
    fields: [
      { key: 'name', label: 'اسم البند', required: true, section: 'البند' },
      { key: 'category', label: 'الفئة', section: 'البند', hint: 'مثل: خرسانة، مباني، لياسة' },
      { key: 'description', label: 'الوصف', type: 'textarea', section: 'البند' },
      { key: 'unit_id', label: 'وحدة القياس', lookup: 'measurement_units', section: 'التسعير' },
      { key: 'default_unit_price', label: 'سعر الوحدة الافتراضي (د.ل)', type: 'number', section: 'التسعير' },
      { key: 'is_active', label: 'مستخدم', type: 'checkbox', section: 'التسعير' },
    ],
    defaults: { is_active: true },
    writeRoles: CATALOG,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'category'],
  },
}

export const ClientsListPage = () => <CrudPage key="clients" config={configs.clients} />
export const SuppliersPage = () => <CrudPage key="suppliers" config={configs.suppliers} />
export const TechniciansPage = () => <CrudPage key="technicians" config={configs.technicians} />
export const EmployeesPage = () => <CrudPage key="employees" config={configs.employees} />
export const EngineersPage = () => <CrudPage key="engineers" config={configs.engineers} />
export const TechnicianTypesPage = () => <CrudPage key="technician_types" config={configs.technician_types} />
export const ExpenseCategoriesPage = () => <CrudPage key="expense_categories" config={configs.expense_categories} />
export const UnitsPage = () => <CrudPage key="measurement_units" config={configs.measurement_units} />
export const CatalogPage = () => <CrudPage key="catalog_items" config={configs.catalog_items} />
