import { useState } from 'react'
import { useProjectsFinancials } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { Modal } from './dialog'
import { useRpc } from './pickers'
import { Button, Field, Select } from './ui'

// دفعة سُجلت على الحساب تُنسب لاحقاً إلى مشروع: تصنيف فقط بلا حركة خزينة، ومرة واحدة
export function AssignProjectDialog({ kind, paymentId, onClose }: { kind: 'supplier' | 'technician'; paymentId: string; onClose: () => void }) {
  const projects = useProjectsFinancials()
  const [project, setProject] = useState('')
  const assign = useRpc(() => supabase.rpc('assign_payment_to_project', { p_kind: kind, p_payment_id: paymentId, p_project_id: project }), { success: 'نُقلت الدفعة إلى المشروع', onDone: onClose })
  return (
    <Modal
      title="نقل الدفعة إلى مشروع"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button loading={assign.isPending} disabled={!project} onClick={() => assign.mutate(undefined)}>
            نقل
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm leading-7 text-muted">تُحسب الدفعة بعدها في حساب الطرف داخل المشروع. لا تتحرك أي خزينة، ولا يمكن نقلها مرة أخرى.</p>
        <Field label="المشروع" required>
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">— اختر المشروع —</option>
            {(projects.data ?? [])
              .filter((p) => p.status !== 'cancelled')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
