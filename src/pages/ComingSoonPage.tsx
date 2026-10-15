import { useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { allNavItems } from '@/nav'
import { Card, PageHeader } from '@/components/ui'

const stageNames: Record<string, string> = {
  ب: 'الزبائن والمشاريع والمراحل والبنود والعقود والقبض',
  ج: 'الموردون والفنيون والمصروفات والخزائن والعُهد',
  د: 'الموظفون والرواتب والمعدات والمخزون',
  هـ: 'التقارير والطباعة',
}

export function ComingSoonPage() {
  const { pathname } = useLocation()
  const item = allNavItems.find((i) => i.path === pathname)
  return (
    <div>
      <PageHeader title={item?.label ?? 'غير موجودة'} />
      <Card className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-300">
        <Construction className="size-5 text-amber-500" />
        {item?.stage
          ? `هذه الشاشة تُبنى في المرحلة (${item.stage}): ${stageNames[item.stage] ?? ''}.`
          : 'هذه الصفحة غير موجودة.'}
      </Card>
    </div>
  )
}
