import { CrudPage, type CrudConfig } from '@/components/CrudPage'
import { Badge, Money } from '@/components/ui'
import { options, rateUnitLabels } from '@/lib/labels'
import type { AppRole } from '@/lib/supabase'

const FIN: AppRole[] = ['admin', 'accountant']
const ADMIN: AppRole[] = ['admin']
const SITE_WRITE: AppRole[] = ['admin', 'accountant', 'engineer', 'supervisor']
const CATALOG: AppRole[] = ['admin', 'supervisor']

const contact = [
  { key: 'phone', label: 'الهاتف' },
  { key: 'email', label: 'البريد', type: 'email' as const },
  { key: 'address', label: 'العنوان' },
]

const active = { key: 'is_active', label: 'الحالة', render: (r: Record<string, unknown>) => (r.is_active ? <Badge tone="green">نشط</Badge> : <Badge>موقوف</Badge>) }

const configs: Record<string, CrudConfig> = {
  clients: {
    table: 'clients',
    title: 'الزبائن',
    singular: 'زبون',
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'city', label: 'المدينة' },
    ],
    fields: [{ key: 'name', label: 'الاسم', required: true }, { key: 'city', label: 'المدينة' }, ...contact, { key: 'notes', label: 'ملاحظات', type: 'textarea' }],
    writeRoles: FIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'phone', 'city'],
  },
  suppliers: {
    table: 'suppliers',
    title: 'الموردون',
    singular: 'مورد',
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'category', label: 'المجال' },
      { key: 'phone', label: 'الهاتف' },
    ],
    fields: [{ key: 'name', label: 'الاسم', required: true }, { key: 'category', label: 'المجال', hint: 'مثل: حديد، إسمنت، كهرباء' }, ...contact, { key: 'notes', label: 'ملاحظات', type: 'textarea' }],
    writeRoles: FIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'phone', 'category'],
  },
  technicians: {
    table: 'technicians',
    title: 'الفنيون',
    singular: 'فني',
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'technician_type_id', label: 'التخصص', render: (r, lk) => lk.technician_types?.get(r.technician_type_id as string) ?? '—' },
      { key: 'phone', label: 'الهاتف' },
      {
        key: 'default_rate',
        label: 'السعر الافتراضي',
        render: (r) =>
          r.default_rate ? (
            <>
              <Money value={r.default_rate as number} /> {rateUnitLabels[r.default_rate_unit as keyof typeof rateUnitLabels] ?? ''}
            </>
          ) : (
            '—'
          ),
      },
      active,
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'technician_type_id', label: 'التخصص', lookup: 'technician_types' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'default_rate', label: 'السعر الافتراضي (د.ل)', type: 'number' },
      { key: 'default_rate_unit', label: 'طريقة الحساب', type: 'select', options: options(rateUnitLabels) },
      { key: 'is_active', label: 'نشط', type: 'checkbox' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
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
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'position', label: 'الوظيفة' },
      { key: 'department', label: 'القسم' },
      { key: 'base_salary', label: 'الراتب الأساسي', render: (r) => <Money value={r.base_salary as number} /> },
      active,
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'position', label: 'الوظيفة' },
      { key: 'department', label: 'القسم' },
      { key: 'base_salary', label: 'الراتب الأساسي (د.ل)', type: 'number' },
      { key: 'hire_date', label: 'تاريخ التعيين', type: 'date' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد', type: 'email' },
      { key: 'is_active', label: 'على رأس العمل', type: 'checkbox' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
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
    columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'specialty', label: 'التخصص' },
      { key: 'phone', label: 'الهاتف' },
    ],
    fields: [
      { key: 'name', label: 'الاسم', required: true },
      { key: 'specialty', label: 'التخصص' },
      { key: 'license_number', label: 'رقم القيد' },
      { key: 'phone', label: 'الهاتف' },
      { key: 'email', label: 'البريد', type: 'email' },
      { key: 'notes', label: 'ملاحظات', type: 'textarea' },
    ],
    writeRoles: ADMIN,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'specialty'],
  },
  technician_types: {
    table: 'technician_types',
    title: 'تخصصات الفنيين',
    singular: 'تخصص',
    description: 'القائمة الوحيدة لتخصصات الفنيين في كل المنظومة',
    columns: [{ key: 'name', label: 'التخصص' }, { key: 'code', label: 'الرمز' }, active],
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
    description: 'بنود جاهزة تُستخدم عند إضافة بنود المقايسة للمشاريع',
    columns: [
      { key: 'name', label: 'البند' },
      { key: 'category', label: 'الفئة' },
      { key: 'unit_id', label: 'الوحدة', render: (r, lk) => lk.measurement_units?.get(r.unit_id as string) ?? '—' },
      { key: 'default_unit_price', label: 'سعر الوحدة', render: (r) => (r.default_unit_price ? <Money value={r.default_unit_price as number} /> : '—') },
      active,
    ],
    fields: [
      { key: 'name', label: 'البند', required: true },
      { key: 'category', label: 'الفئة' },
      { key: 'unit_id', label: 'وحدة القياس', lookup: 'measurement_units' },
      { key: 'default_unit_price', label: 'سعر الوحدة الافتراضي (د.ل)', type: 'number' },
      { key: 'description', label: 'الوصف', type: 'textarea' },
      { key: 'is_active', label: 'مستخدم', type: 'checkbox' },
    ],
    defaults: { is_active: true },
    writeRoles: CATALOG,
    deleteRoles: ADMIN,
    searchKeys: ['name', 'category'],
  },
}

export const ClientsPage = () => <CrudPage key="clients" config={configs.clients} />
export const SuppliersPage = () => <CrudPage key="suppliers" config={configs.suppliers} />
export const TechniciansPage = () => <CrudPage key="technicians" config={configs.technicians} />
export const EmployeesPage = () => <CrudPage key="employees" config={configs.employees} />
export const EngineersPage = () => <CrudPage key="engineers" config={configs.engineers} />
export const TechnicianTypesPage = () => <CrudPage key="technician_types" config={configs.technician_types} />
export const ExpenseCategoriesPage = () => <CrudPage key="expense_categories" config={configs.expense_categories} />
export const UnitsPage = () => <CrudPage key="measurement_units" config={configs.measurement_units} />
export const CatalogPage = () => <CrudPage key="catalog_items" config={configs.catalog_items} />
