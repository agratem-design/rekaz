import {
  Banknote, Boxes, DatabaseBackup, Building2, ClipboardList, FileSignature, FileText, HardHat, LayoutDashboard, Landmark, LayoutGrid,
  Package, Paintbrush, Receipt, Ruler, ScrollText, Settings, Shapes, ShoppingCart, Tags, Truck, UserCog, Users, Wallet, Wrench, ArrowLeftRight, type LucideIcon,
} from 'lucide-react'
import type { AppRole } from './lib/supabase'

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  roles?: AppRole[] // بدون قيمة = كل الموظفين
  stage?: string // المرحلة التي تُبنى فيها الشاشة إن لم تكن جاهزة
  keywords?: string // كلمات إضافية للبحث السريع
}

export type NavSection = { title: string; items: NavItem[] }

const FIN: AppRole[] = ['admin', 'accountant']
const SITE: AppRole[] = ['admin', 'engineer', 'supervisor']

// الأسماء مأخوذة من النظام السابق حتى لا يتغير على المستخدم ما اعتاده (docs/old-flows.md)
export const navSections: NavSection[] = [
  { title: 'الرئيسية', items: [{ path: '/', label: 'لوحة التحكم', icon: LayoutDashboard, keywords: 'الرئيسية المؤشرات' }] },
  {
    title: 'المشاريع والعقود',
    items: [
      { path: '/projects/contracting', label: 'مشاريع المقاولات', icon: Building2 },
      { path: '/projects/finishing', label: 'مشاريع التشطيبات', icon: Paintbrush },
      { path: '/contracts', label: 'سجل العقود', icon: FileSignature, roles: ['admin'], keywords: 'العقود' },
    ],
  },
  {
    title: 'أطراف التعامل',
    items: [
      { path: '/clients', label: 'الزبائن', icon: Users, keywords: 'العملاء كشف حساب' },
      { path: '/suppliers', label: 'الموردون', icon: Truck },
      { path: '/technicians', label: 'الفنيون', icon: Wrench, keywords: 'العمال' },
      { path: '/employees', label: 'الموظفون', icon: UserCog, roles: FIN, keywords: 'الرواتب' },
      { path: '/engineers', label: 'المهندسون', icon: HardHat },
    ],
  },
  {
    title: 'المالية',
    items: [
      { path: '/treasuries', label: 'الخزائن والحسابات', icon: Landmark, roles: FIN, keywords: 'الخزينة البنك' },
      { path: '/receipts', label: 'إيصالات المقبوضات', icon: Banknote, roles: FIN, keywords: 'القبض الدفعات التسديد' },
      { path: '/purchases', label: 'مركز الفواتير', icon: ShoppingCart, roles: FIN, keywords: 'المشتريات السداد الموردين سند صرف' },
      { path: '/expenses', label: 'المصروفات العامة', icon: Receipt, roles: FIN, keywords: 'مصروف' },
      { path: '/transfers', label: 'التحويلات', icon: ArrowLeftRight, roles: FIN, keywords: 'تحويل' },
      { path: '/payroll', label: 'الرواتب والسلف', icon: Wallet, roles: FIN, keywords: 'راتب استقطاع موظف مسير' },
      { path: '/import', label: 'استيراد من Excel', icon: FileText, roles: FIN, keywords: 'اكسل استيراد جماعي بنود مصروفات' },
      { path: '/custodies', label: 'العهد المالية', icon: Wallet, roles: FIN, keywords: 'عهدة' },
    ],
  },
  {
    title: 'التشغيل',
    items: [
      { path: '/catalog', label: 'البنود العامة', icon: LayoutGrid, roles: SITE },
      { path: '/units', label: 'وحدات القياس', icon: Ruler, roles: SITE },
      { path: '/technician-types', label: 'تخصصات الفنيين', icon: Shapes },
      { path: '/expense-categories', label: 'فئات المصروفات', icon: Tags, roles: FIN },
      { path: '/equipment', label: 'المعدات', icon: Package, roles: FIN },
      { path: '/inventory', label: 'المخازن', icon: Boxes, roles: FIN, keywords: 'المخزون' },
    ],
  },
  {
    title: 'التقارير والإدارة',
    items: [
      { path: '/reports', label: 'التقارير', icon: FileText, roles: FIN, keywords: 'كشف تقرير ربحية ديون' },
      { path: '/users', label: 'إدارة المستخدمين', icon: ClipboardList, roles: ['admin'], keywords: 'الصلاحيات' },
      { path: '/audit', label: 'سجل التعديلات والرقابة', icon: ScrollText, roles: ['admin'], keywords: 'سجل العمليات' },
      { path: '/backup', label: 'النسخ الاحتياطي', icon: DatabaseBackup, roles: ['admin'], keywords: 'تصدير نسخة' },
      { path: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin'], keywords: 'تصميم الطباعة الهوية' },
    ],
  },
]

export const allNavItems = navSections.flatMap((s) => s.items)
