import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { Badge, Button, Card, ErrorState, Field, Input, PageHeader, Spinner } from '@/components/ui'
import { options, roleLabels } from '@/lib/labels'
import { errorMessage, supabase, type AppRole } from '@/lib/supabase'

async function adminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null
    throw new Error(msg ?? error.message)
  }
  return data
}

export function UsersPage() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', display_name: '', password: '', roles: [] as AppRole[] })
  const [pwFor, setPwFor] = useState<{ id: string; name: string } | null>(null)
  const [newPw, setNewPw] = useState('')

  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from('profiles').select('*').order('display_name'), supabase.from('user_roles').select('*')])
      if (p.error) throw p.error
      if (r.error) throw r.error
      return p.data.map((u) => ({ ...u, roles: r.data.filter((x) => x.user_id === u.id).map((x) => x.role) }))
    },
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const toggleRole = useMutation({
    mutationFn: async ({ userId, role, on }: { userId: string; role: AppRole; on: boolean }) => {
      const { error } = on
        ? await supabase.from('user_roles').insert({ user_id: userId, role })
        : await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })

  const create = useMutation({
    mutationFn: () => adminUsers({ action: 'create', ...form }),
    onSuccess: () => {
      toast.success('تم إنشاء المستخدم')
      setCreating(false)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const setPassword = useMutation({
    mutationFn: () => adminUsers({ action: 'set_password', user_id: pwFor!.id, password: newPw }),
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور')
      setPwFor(null)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const createDirty = Boolean(form.username || form.display_name || form.password || form.roles.length)

  if (users.isLoading) return <Spinner />
  if (users.error) return <ErrorState message={errorMessage(users.error)} />

  return (
    <div>
      <PageHeader
        title="المستخدمون"
        description="الصلاحيات تُطبَّق داخل قاعدة البيانات، وليس بإخفاء الشاشات فقط"
        actions={
          <Button
            onClick={() => {
              setForm({ username: '', display_name: '', password: '', roles: [] })
              setCreating(true)
            }}
          >
            <Plus className="size-4" />
            مستخدم جديد
          </Button>
        }
      />
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 dark:bg-stone-800/50">
            <tr>
              <th className="px-3 py-2 text-right font-medium">الاسم</th>
              <th className="px-3 py-2 text-right font-medium">اسم الدخول</th>
              <th className="px-3 py-2 text-right font-medium">الأدوار</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.data!.map((u) => {
              const self = u.id === session?.user.id
              return (
                <tr key={u.id} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="px-3 py-2">{u.display_name}</td>
                  <td className="px-3 py-2 num">{u.username}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-3">
                      {options(roleLabels).map((r) => (
                        <label key={r.value} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="accent-brand-600"
                            checked={u.roles.includes(r.value)}
                            disabled={self && r.value === 'admin'}
                            onChange={(e) => toggleRole.mutate({ userId: u.id, role: r.value, on: e.target.checked })}
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button disabled={self} onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}>
                      {u.is_active ? <Badge tone="green">نشط</Badge> : <Badge tone="red">موقوف</Badge>}
                    </button>
                  </td>
                  <td className="px-2 text-left">
                    <Button
                      variant="ghost"
                      className="size-8 px-0"
                      aria-label="تغيير كلمة المرور"
                      onClick={() => {
                        setNewPw('')
                        setPwFor({ id: u.id, name: u.display_name })
                      }}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <SidePanel
        open={creating}
        title="مستخدم جديد"
        dirty={createDirty}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              إنشاء
            </Button>
            <Button variant="secondary" onClick={() => confirmDiscard(createDirty) && setCreating(false)}>
              إلغاء
            </Button>
          </>
        }
      >
        <Field label="الاسم الظاهر" required>
          <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </Field>
        <Field label="اسم الدخول" required hint="حروف إنجليزية صغيرة وأرقام، مثل: ali.salem">
          <Input dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="كلمة المرور" required hint="8 أحرف على الأقل">
          <Input dir="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="الأدوار" group>
          <div className="flex flex-wrap gap-3 text-sm">
            {options(roleLabels).map((r) => (
              <label key={r.value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={form.roles.includes(r.value)}
                  onChange={(e) =>
                    setForm({ ...form, roles: e.target.checked ? [...form.roles, r.value] : form.roles.filter((x) => x !== r.value) })
                  }
                />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
      </SidePanel>

      <SidePanel
        open={pwFor !== null}
        title={`كلمة مرور جديدة: ${pwFor?.name ?? ''}`}
        onClose={() => setPwFor(null)}
        footer={
          <>
            <Button loading={setPassword.isPending} onClick={() => setPassword.mutate()}>
              حفظ
            </Button>
            <Button variant="secondary" onClick={() => setPwFor(null)}>
              إلغاء
            </Button>
          </>
        }
      >
        <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
          <Input dir="ltr" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
      </SidePanel>
    </div>
  )
}
