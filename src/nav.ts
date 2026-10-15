import {
  Banknote, Boxes, Building2, ClipboardList, FileSignature, FileText, HardHat, Home, Landmark, LayoutGrid,
  Package, Paintbrush, Receipt, Ruler, ScrollText, Settings, Shapes, ShoppingCart, Tags, Truck, UserCog, Users, Wallet, Wrench, ArrowLeftRight, type LucideIcon,
} from 'lucide-react'
import type { AppRole } from './lib/supabase'

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  roles?: AppRole[] // بدون قيمة = كل الموظفين
  stage?: string // المرحلة التي تُبنى فيها الشاشة إن لم تكن جاهزة
}

export type NavSection = { title: string; items: NavItem[] }

const FIN: AppRole[] = ['admin', 'accountant']
const SITE: AppRole[] = ['admin', 'engineer', 'supervisor']

export const navSections: NavSection[] = [
  { title: 'الرئيسية', items: [{ path: '/', label: 'لوحة المؤشرات', icon: Home }] },
  {
    title: 'المشاريع والعقود',
    items: [
      { path: '/projects/contracting', label: 'مشاريع المقاولات', icon: Building2, stage: 'ب' },
      { path: '/projects/finishing', label: 'مشاريع التشطيبات', icon: Paintbrush, stage: 'ب' },
      { path: '/contracts', label: 'العقود', icon: FileSignature, roles: ['admin'], stage: 'ب' },
    ],
  },
  {
    title: 'أطراف التعامل',
    items: [
      { path: '/clients', label: 'الزبائن', icon: Users },
      { path: '/suppliers', label: 'الموردون', icon: Truck },
      { path: '/technicians', label: 'الفنيون', icon: Wrench },
      { path: '/employees', label: 'الموظفون', icon: UserCog, roles: FIN },
      { path: '/engineers', label: 'المهندسون', icon: HardHat },
    ],
  },
  {
    title: 'المالية',
    items: [
      { path: '/treasuries', label: 'الخزائن', icon: Landmark, roles: FIN },
      { path: '/receipts', label: 'القبض من الزبائن', icon: Banknote, roles: FIN, stage: 'ب' },
      { path: '/purchases', label: 'المشتريات والسداد', icon: ShoppingCart, roles: FIN, stage: 'ج' },
      { path: '/expenses', label: 'المصروفات', icon: Receipt, roles: FIN, stage: 'ج' },
      { path: '/transfers', label: 'التحويلات', icon: ArrowLeftRight, roles: FIN, stage: 'ج' },
      { path: '/custodies', label: 'العُهد', icon: Wallet, roles: FIN, stage: 'ج' },
    ],
  },
  {
    title: 'التشغيل',
    items: [
      { path: '/catalog', label: 'البنود العامة', icon: LayoutGrid, roles: SITE },
      { path: '/units', label: 'وحدات القياس', icon: Ruler, roles: SITE },
      { path: '/technician-types', label: 'تخصصات الفنيين', icon: Shapes },
      { path: '/expense-categories', label: 'فئات المصروفات', icon: Tags, roles: FIN },
      { path: '/equipment', label: 'المعدات', icon: Package, roles: SITE, stage: 'د' },
      { path: '/inventory', label: 'المخزون', icon: Boxes, roles: SITE, stage: 'د' },
    ],
  },
  {
    title: 'التقارير والإدارة',
    items: [
      { path: '/reports', label: 'التقارير', icon: FileText, stage: 'هـ' },
      { path: '/users', label: 'المستخدمون', icon: ClipboardList, roles: ['admin'] },
      { path: '/audit', label: 'سجل العمليات', icon: ScrollText, roles: ['admin'] },
      { path: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin'] },
    ],
  },
]

export const allNavItems = navSections.flatMap((s) => s.items)

