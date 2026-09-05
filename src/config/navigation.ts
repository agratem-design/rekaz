import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Users,
  Receipt,
  HardHat,
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Wrench,
  Warehouse,
  BarChart3,
  Settings,
  Package,
  Calendar,
  Database,
  History,
  Shield,
  Palette,
  Truck,
  CreditCard,
  GraduationCap,
  UserCog,
  Landmark,
  Scale,
} from 'lucide-react';

export type AppUserRole = 'admin' | 'engineer' | 'accountant' | 'supervisor' | 'employee';

export interface NavigationItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppUserRole[];
  groupId: string;
  groupLabel: string;
  isPrimarySidebar: boolean;
  keywords?: string[];
  subtitle?: string;
  badge?: boolean;
  matchPrefixes?: string[];
  getHrefForRole?: (role: AppUserRole | null | undefined, isAdmin?: boolean) => string;
  isActive?: (pathname: string, role?: AppUserRole | null) => boolean;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
}

/**
 * All Navigation Items (Primary Sidebar + Long-Tail Accessible Pages)
 */
export const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  // ==========================================
  // GROUP 1: الرئيسية (1 Item)
  // ==========================================
  {
    id: 'dashboard',
    name: 'لوحة التحكم',
    href: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'engineer', 'supervisor', 'accountant'],
    groupId: 'main',
    groupLabel: 'الرئيسية',
    isPrimarySidebar: true,
    keywords: ['رئيسية', 'لوحة التحكم', 'مؤشرات', 'dashboard', 'overview', 'محاسبة'],
    subtitle: 'مؤشرات الأداء العامة والتنبيهات التشغيلية والمالية',
    getHrefForRole: (role) => (role === 'accountant' ? '/accountant' : '/'),
    isActive: (pathname) => pathname === '/' || pathname === '/accountant',
  },

  // ==========================================
  // GROUP 2: المشاريع والعقود (4 Items)
  // ==========================================
  {
    id: 'contracting-projects',
    name: 'مشاريع المقاولات',
    href: '/projects/contracting',
    icon: FolderKanban,
    roles: ['admin', 'engineer', 'supervisor'],
    groupId: 'projects_contracts',
    groupLabel: 'المشاريع والعقود',
    isPrimarySidebar: true,
    keywords: ['مقاولات', 'مشاريع', 'بناء', 'عظم', 'contracting'],
    subtitle: 'مشاريع المقاولات العامة وحساب الكميات والمقايسات',
  },
  {
    id: 'finishing-projects',
    name: 'مشاريع التشطيبات',
    href: '/projects/finishing',
    icon: FolderKanban,
    roles: ['admin', 'engineer', 'supervisor'],
    groupId: 'projects_contracts',
    groupLabel: 'المشاريع والعقود',
    isPrimarySidebar: true,
    keywords: ['تشطيبات', 'ديكور', 'finishing', 'cost plus'],
    subtitle: 'مشاريع التشطيبات والديكور بنظام التكلفة والنسبة',
  },
  {
    id: 'contracts',
    name: 'سجل العقود',
    href: '/contracts',
    icon: FileText,
    roles: ['admin'],
    groupId: 'projects_contracts',
    groupLabel: 'المشاريع والعقود',
    isPrimarySidebar: true,
    matchPrefixes: ['/contracts'],
    keywords: ['عقود', 'اتفاقيات', 'قانوني', 'contracts', 'legal'],
    subtitle: 'السجل المركزي للعقود والاتفاقيات المعتمدة للشركة',
  },
  {
    id: 'general-items',
    name: 'البنود العامة',
    href: '/general-items',
    icon: Package,
    roles: ['admin', 'supervisor'],
    groupId: 'projects_contracts',
    groupLabel: 'المشاريع والعقود',
    isPrimarySidebar: true,
    matchPrefixes: ['/general-items'],
    keywords: ['بنود عامة', 'قوالب المقايسة', 'master items', 'مكتبة البنود الافتراضية والمتطلبات'],
    subtitle: 'مكتبة البنود الافتراضية ومتطلباتها',
  },

  // ==========================================
  // GROUP 3: أطراف التعامل (4 Items)
  // ==========================================
  {
    id: 'clients',
    name: 'العملاء',
    href: '/clients',
    icon: Users,
    roles: ['admin', 'accountant'],
    groupId: 'parties',
    groupLabel: 'أطراف التعامل',
    isPrimarySidebar: true,
    matchPrefixes: ['/clients'],
    keywords: ['عملاء', 'زبائن', 'clients', 'customers'],
    subtitle: 'دليل الزبائن وحساباتهم ومستحقات المشاريع',
  },
  {
    id: 'suppliers',
    name: 'الموردون',
    href: '/suppliers',
    icon: Receipt,
    roles: ['admin', 'accountant'],
    groupId: 'parties',
    groupLabel: 'أطراف التعامل',
    isPrimarySidebar: true,
    matchPrefixes: ['/suppliers'],
    keywords: ['موردين', 'موردون', 'suppliers', 'vendors', 'مشتريات'],
    subtitle: 'دليل الموردين وفواتير الشراء والتسويات المالية',
  },
  {
    id: 'technicians',
    name: 'الفنيون',
    href: '/technicians',
    icon: HardHat,
    roles: ['admin', 'engineer', 'supervisor'],
    groupId: 'parties',
    groupLabel: 'أطراف التعامل',
    isPrimarySidebar: true,
    matchPrefixes: ['/technicians'],
    keywords: ['فنيين', 'عمالة', 'صنائعية', 'technicians', 'labor'],
    subtitle: 'دليل الفنيين ومتابعة الإنجاز والمستحقات الميدانية',
  },
  {
    id: 'employees',
    name: 'الموظفون والرواتب والعُهد',
    href: '/employees',
    icon: UserCog,
    roles: ['admin', 'accountant'],
    groupId: 'parties',
    groupLabel: 'أطراف التعامل',
    isPrimarySidebar: true,
    matchPrefixes: ['/employees'],
    keywords: ['موظفين', 'فريق العمل', 'employees', 'رواتب', 'سلف', 'عهد', 'مرتبات', 'payroll', 'مسير'],
    subtitle: 'إدارة شؤون الموظفين والرواتب الشهرية والسلف والعهد المالية',
  },

  // ==========================================
  // GROUP 4: المالية (5 Items)
  // ==========================================
  {
    id: 'treasuries',
    name: 'الخزائن والحسابات',
    href: '/treasuries',
    icon: Wallet,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: true,
    matchPrefixes: ['/treasuries'],
    keywords: ['خزائن', 'حسابات', 'بنوك', 'نقدية', 'treasury', 'bank'],
    subtitle: 'أرصدة الخزائن الرئيسية والفرعية والحسابات المصرفية',
  },
  {
    id: 'invoice-control',
    name: 'مركز الفواتير',
    href: '/invoice-control',
    icon: Receipt,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: true,
    matchPrefixes: ['/invoice-control'],
    keywords: ['فواتير', 'مشتريات', 'اعتماد', 'invoices'],
    subtitle: 'مراجعة واعتماد فواتير المشتريات ومستحقات الموردين',
  },
  {
    id: 'client-payments',
    name: 'إيصالات المقبوضات',
    href: '/client-payments',
    icon: TrendingUp,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: true,
    matchPrefixes: ['/client-payments'],
    keywords: ['قبض', 'سندات', 'إيصالات', 'مقبوضات', 'receipts', 'payments'],
    subtitle: 'سجل سندات وإيصالات تحصيل الدفعات من الزبائن',
  },
  {
    id: 'general-expenses',
    name: 'المصروفات العامة',
    href: '/expenses',
    icon: TrendingDown,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: true,
    matchPrefixes: ['/expenses'],
    keywords: ['مصروفات', 'مصاريف', 'إدارية', 'expenses', 'overhead'],
    subtitle: 'المصروفات التشغيلية والإدارية العامة غير المنسوبة لمشاريع',
  },
  {
    id: 'transfers',
    name: 'التحويلات',
    href: '/transfers',
    icon: ArrowLeftRight,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: true,
    matchPrefixes: ['/transfers'],
    keywords: ['تحويلات', 'حركات', 'نقل', 'transfers'],
    subtitle: 'سجل التحويلات المالية بين الخزائن والحسابات المصرفية',
  },

  // ==========================================
  // GROUP 5: التشغيل (2 Items)
  // ==========================================
  {
    id: 'equipment',
    name: 'المعدات',
    href: '/equipment',
    icon: Wrench,
    roles: ['admin', 'supervisor'],
    groupId: 'operations',
    groupLabel: 'التشغيل',
    isPrimarySidebar: true,
    matchPrefixes: ['/equipment'],
    keywords: ['معدات', 'آليات', 'أصول', 'equipment', 'machinery'],
    subtitle: 'سجل معدات وآليات الشركة وحالات التشغيل والصيانة',
  },
  {
    id: 'inventory',
    name: 'المخازن',
    href: '/inventory',
    icon: Warehouse,
    roles: ['admin', 'supervisor'],
    groupId: 'operations',
    groupLabel: 'التشغيل',
    isPrimarySidebar: true,
    matchPrefixes: ['/inventory'],
    keywords: ['مخازن', 'مستودعات', 'مواد', 'inventory', 'stock'],
    subtitle: 'إدارة المستودعات المركزية وأرصدة وحركات المواد',
  },

  // ==========================================
  // GROUP 6: التقارير والإدارة (2 Items)
  // ==========================================
  {
    id: 'reports',
    name: 'التقارير',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin'],
    groupId: 'reports_admin',
    groupLabel: 'التقارير والإدارة',
    isPrimarySidebar: true,
    matchPrefixes: ['/reports'],
    keywords: ['تقارير', 'إحصائيات', 'كشوفات', 'reports', 'analytics'],
    subtitle: 'مركز التقارير المالية والتنفيذية الشاملة للمنظومة',
  },
  {
    id: 'settings',
    name: 'الإعدادات',
    href: '/settings',
    icon: Settings,
    roles: ['admin'],
    groupId: 'reports_admin',
    groupLabel: 'التقارير والإدارة',
    isPrimarySidebar: true,
    matchPrefixes: ['/settings'],
    keywords: ['إعدادات', 'تهيئة', 'خيارات', 'settings', 'configuration'],
    subtitle: 'إعدادات النظام العامة وبيانات المؤسسة والخزائن والمظهر',
  },

  // ==========================================
  // LONG-TAIL ACCESSIBLE DESTINATIONS (Not in Primary 17 Sidebar)
  // ==========================================
  {
    id: 'client-activities',
    name: 'سجل حركات الزبائن',
    href: '/client-activities',
    icon: Users,
    roles: ['admin', 'accountant'],
    groupId: 'parties',
    groupLabel: 'أطراف التعامل',
    isPrimarySidebar: false,
    keywords: ['حركات الزبائن', 'كشف نشاط', 'activities'],
    subtitle: 'السجل الشامل لحركات وفواتير ومطالبات الزبائن',
  },
  {
    id: 'measurement-types',
    name: 'وحدات القياس',
    href: '/measurement-types',
    icon: Scale,
    roles: ['admin'],
    groupId: 'master_data',
    groupLabel: 'البيانات الأساسية',
    isPrimarySidebar: false,
    keywords: ['وحدات القياس', 'متر', 'units'],
    subtitle: 'جدول وحدات القياس المعتمدة للمواد والبنود',
  },
  {
    id: 'rentals',
    name: 'إيجارات المشاريع',
    href: '/rentals',
    icon: Truck,
    roles: ['admin', 'supervisor'],
    groupId: 'operations',
    groupLabel: 'التشغيل',
    isPrimarySidebar: false,
    badge: true,
    keywords: ['إيجارات', 'معدات مستأجرة', 'rentals'],
    subtitle: 'كشف متابعة إيجارات المعدات والآليات على مستوى المشاريع',
  },
  {
    id: 'engineers',
    name: 'المهندسون',
    href: '/engineers',
    icon: GraduationCap,
    roles: ['admin'],
    groupId: 'team',
    groupLabel: 'إدارة الفريق',
    isPrimarySidebar: false,
    matchPrefixes: ['/engineers'],
    keywords: ['مهندسين', 'مشرفين', 'engineers'],
    subtitle: 'سجل المهندسين المشرفين على المشاريع',
  },
  {
    id: 'project-expenses',
    name: 'مصروفات المشاريع المجمعة',
    href: '/project-expenses',
    icon: Coins,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: false,
    keywords: ['مصروفات المشاريع', 'تكاليف', 'project expenses'],
    subtitle: 'كشف تجميعي شامل لمصروفات كافة المشاريع',
  },
  {
    id: 'debts',
    name: 'ديون وذمم الزبائن',
    href: '/debts',
    icon: CreditCard,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: false,
    keywords: ['ديون', 'ذمم', 'مطالبات', 'debts', 'receivables'],
    subtitle: 'كشف الديون والالتزامات المالية ومتابعة التحصيل',
  },
  {
    id: 'contract-templates',
    name: 'قوالب بنود العقود',
    href: '/contract-templates',
    icon: FileText,
    roles: ['admin'],
    groupId: 'master_data',
    groupLabel: 'البيانات الأساسية',
    isPrimarySidebar: false,
    keywords: ['قوالب العقود', 'شروط قانونية', 'contract templates'],
    subtitle: 'مكتبة الشروط والبنود النموذجية للعقود القانونية',
  },
  {
    id: 'database-backup',
    name: 'النسخ الاحتياطي',
    href: '/database-backup',
    icon: Database,
    roles: ['admin'],
    groupId: 'system',
    groupLabel: 'النظام والأمان',
    isPrimarySidebar: false,
    keywords: ['نسخ احتياطي', 'حفظ البيانات', 'backup'],
    subtitle: 'أداة تصدير واسترجاع قاعدة بيانات المنظومة',
  },
  {
    id: 'audit-log',
    name: 'سجل التعديلات والرقابة',
    href: '/audit-log',
    icon: History,
    roles: ['admin'],
    groupId: 'system',
    groupLabel: 'النظام والأمان',
    isPrimarySidebar: false,
    keywords: ['سجل التعديلات', 'تدقيق', 'رقابة', 'audit log'],
    subtitle: 'سجل العمليات وتعديلات البيانات وحركات المستخدمين',
  },
  {
    id: 'users',
    name: 'إدارة المستخدمين',
    href: '/users',
    icon: Shield,
    roles: ['admin'],
    groupId: 'system',
    groupLabel: 'النظام والأمان',
    isPrimarySidebar: false,
    keywords: ['مستخدمين', 'حسابات', 'صلاحيات', 'users', 'roles'],
    subtitle: 'إدارة حسابات النظام وكلمات المرور والصلاحيات',
  },
  {
    id: 'calendar',
    name: 'التقويم والمواعيد',
    href: '/calendar',
    icon: Calendar,
    roles: ['admin'],
    groupId: 'system',
    groupLabel: 'النظام والأمان',
    isPrimarySidebar: false,
    keywords: ['تقويم', 'مواعيد', 'تسليم', 'calendar'],
    subtitle: 'تقويم مواعيد التسليم وأنشطة المشاريع',
  },
  {
    id: 'print-design',
    name: 'تصميم الطباعة والهوية',
    href: '/print-design',
    icon: Palette,
    roles: ['admin'],
    groupId: 'system',
    groupLabel: 'النظام والأمان',
    isPrimarySidebar: false,
    keywords: ['طباعة', 'هوية', 'تصميم', 'print design'],
    subtitle: 'تخصيص نماذج الإيصالات والفواتير والمستندات المطبوعة',
  },
  {
    id: 'custody',
    name: 'العهد المالية',
    href: '/custody',
    icon: Landmark,
    roles: ['admin', 'accountant'],
    groupId: 'finance',
    groupLabel: 'المالية',
    isPrimarySidebar: false,
    matchPrefixes: ['/custody'],
    keywords: ['عهدة', 'عهد مالية', 'custody'],
    subtitle: 'كشف ومتابعة العهد المالية المفتوحة وتسوياتها',
  },
];

/**
 * Exact Ordered Group Definitions for Primary Sidebar
 */
export const PRIMARY_SIDEBAR_GROUP_IDS = [
  'main',
  'projects_contracts',
  'parties',
  'finance',
  'operations',
  'reports_admin',
] as const;

export const PRIMARY_SIDEBAR_GROUPS_META: Record<
  (typeof PRIMARY_SIDEBAR_GROUP_IDS)[number],
  { id: string; label: string }
> = {
  main: { id: 'main', label: 'الرئيسية' },
  projects_contracts: { id: 'projects_contracts', label: 'المشاريع والعقود' },
  parties: { id: 'parties', label: 'أطراف التعامل' },
  finance: { id: 'finance', label: 'المالية' },
  operations: { id: 'operations', label: 'التشغيل' },
  reports_admin: { id: 'reports_admin', label: 'التقارير والإدارة' },
};

/**
 * Returns the canonical filtered groups for the primary sidebar.
 * Strictly enforces:
 * 1. Exactly 6 groups
 * 2. Exactly 17 primary items
 * 3. Exact role-safe filtering
 * 4. Deterministic role-based destination resolution (e.g. Dashboard)
 */
export function getCanonicalSidebarGroups(
  userRole?: AppUserRole | null,
  isAdmin: boolean = false
): NavigationGroup[] {
  const effectiveRole: AppUserRole = userRole || (isAdmin ? 'admin' : 'employee');

  const primaryItems = ALL_NAVIGATION_ITEMS.filter((item) => item.isPrimarySidebar);

  const groups: NavigationGroup[] = PRIMARY_SIDEBAR_GROUP_IDS.map((gId) => {
    const meta = PRIMARY_SIDEBAR_GROUPS_META[gId];
    const groupItems = primaryItems
      .filter((item) => item.groupId === gId)
      .filter((item) => {
        if (isAdmin && item.roles.includes('admin')) return true;
        return item.roles.includes(effectiveRole);
      })
      .map((item) => {
        // Resolve dynamic role destination if defined
        const resolvedHref = item.getHrefForRole
          ? item.getHrefForRole(effectiveRole, isAdmin)
          : item.href;
        return {
          ...item,
          href: resolvedHref,
        };
      });

    return {
      id: meta.id,
      label: meta.label,
      items: groupItems,
    };
  });

  return groups.filter((g) => g.items.length > 0);
}

/**
 * Returns all searchable navigation destinations for Global Command Palette
 */
export function getAllSearchableNavItems(
  userRole?: AppUserRole | null,
  isAdmin: boolean = false
): NavigationItem[] {
  const effectiveRole: AppUserRole = userRole || (isAdmin ? 'admin' : 'employee');

  return ALL_NAVIGATION_ITEMS.filter((item) => {
    if (isAdmin && item.roles.includes('admin')) return true;
    return item.roles.includes(effectiveRole);
  }).map((item) => {
    const resolvedHref = item.getHrefForRole
      ? item.getHrefForRole(effectiveRole, isAdmin)
      : item.href;
    return {
      ...item,
      href: resolvedHref,
    };
  });
}

/**
 * Helper to check if a navigation item is active based on current path
 */
export function isNavItemActive(
  item: NavigationItem,
  currentPath: string,
  userRole?: AppUserRole | null
): boolean {
  if (item.isActive) {
    return item.isActive(currentPath, userRole);
  }

  if (item.matchPrefixes && item.matchPrefixes.length > 0) {
    if (
      currentPath === item.href ||
      currentPath.startsWith(item.href + '/') ||
      item.matchPrefixes.some((p) => currentPath === p || currentPath.startsWith(p + '/'))
    ) {
      return true;
    }
  }

  if (item.href === '/') {
    return currentPath === '/';
  }

  return currentPath === item.href || currentPath.startsWith(item.href + '/');
}
