import { Link, useLocation } from 'react-router-dom'
import { Construction, SearchX } from 'lucide-react'
import { allNavItems } from '@/nav'
import { Button, Card, EmptyState, PageHeader } from '@/components/ui'

export const stageNames: Record<string, string> = {
  ب: 'الزبائن والمشاريع والمراحل والبنود والعقود والقبض',
  ج: 'الموردون والفنيون والمصروفات والخزائن والعُهد',
  د: 'الرواتب والسلف والمعدات وإيجاراتها والمخزون، وتحتاج جداول ودوال جديدة في قاعدة البيانات قبل بنائها',
  هـ: 'التقارير والطباعة',
}

export function StageNotice({ stage, title }: { stage: string; title?: string }) {
  return (
    <Card>
      <EmptyState icon={Construction} title={title ?? 'قيد البناء'}>
        هذه الشاشة تُبنى في المرحلة ({stage}): {stageNames[stage] ?? ''}.
      </EmptyState>
    </Card>
  )
}

export function ComingSoonPage() {
  const { pathname } = useLocation()
  const item = allNavItems.find((i) => i.path === pathname)
  if (!item)
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="هذه الصفحة غير موجودة"
          action={
            <Link to="/">
              <Button variant="secondary">العودة إلى لوحة التحكم</Button>
            </Link>
          }
        >
          ربما تغيّر الرابط أو حُذفت الصفحة.
        </EmptyState>
      </Card>
    )
  return (
    <div>
      <PageHeader title={item.label} />
      <StageNotice stage={item.stage ?? ''} />
    </div>
  )
}
