import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { SidePanel, confirmDiscard } from '@/components/SidePanel'
import { DataTable, RecordCount } from '@/components/DataTable'
import { ask } from '@/components/dialog'
import { Avatar, Badge, Button, Checkbox, Field, Input, PageHeader, SearchInput, Section, StatCard } from '@/components/ui'
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

const emptyForm = { username: '', display_name: '', password: '', roles: [] as AppRole[] }

export function UsersPage() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
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
    onSuccess: (_d, v) => {
      toast.success(v.active ? 'تم تفعيل المستخدم' : 'تم إيقاف المستخدم')
      refresh()
    },
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
  const submitCreate = () => {
    const e: Record<string, string> = {}
    if (!form.display_name.trim()) e.display_name = 'الاسم الظاهر مطلوب'
    if (!/^[a-z0-9._-]{3,32}$/.test(form.username)) e.username = 'من 3 إلى 32 حرفاً إنجليزياً صغيراً أو رقماً'
    if (form.password.length < 8) e.password = 'كلمة المرور 8 أحرف على الأقل'
    if (!form.roles.length) e.roles = 'اختر دوراً واحداً على الأقل'
    setErrors(e)
    if (!Object.keys(e).length) create.mutate()
  }

  const all = users.data ?? []
  const q = search.trim()
  const shown = all.filter((u) => !q || u.display_name.includes(q) || (u.username ?? '').includes(q.toLowerCase()))
  const activeCount = all.filter((u) => u.is_active).length

  return (
    <div>
      <PageHeader
        title="إدارة المستخدمين"
        description="الصلاحيات تُطبَّق داخل قاعدة البيانات، وليس بإخفاء الشاشات فقط"
        actions={
          <Button
            onClick={() => {
              setForm(emptyForm)
              setErrors({})
              setCreating(true)
            }}
          >
            <Plus className="size-4" />
            مستخدم جديد
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Users} label="المستخدمون" value={<span className="num">{all.length}</span>} />
        <StatCard icon={UserCheck} label="نشط" value={<span className="num">{activeCount}</span>} tone="blue" />
        <StatCard icon={ShieldCheck} label="مديرون" value={<span className="num">{all.filter((u) => u.roles.includes('admin')).length}</span>} tone="sand" />
      </div>

      <DataTable
        rows={shown}
        getKey={(u) => u.id}
        loading={users.isLoading}
        error={users.error ? errorMessage(users.error) : null}
        onRetry={() => users.refetch()}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو اسم الدخول…" />
            <div className="ms-auto">
              <RecordCount shown={shown.length} total={all.length} />
            </div>
          </>
        }
        columns={[
          {
            key: 'name',
            label: 'المستخدم',
            render: (u) => (
              <span className="flex items-center gap-2.5">
                <Avatar name={u.display_name} />
                <span>
                  <span className="block font-medium">{u.display_name}</span>
                  <span className="num block text-xs text-muted">{u.username}</span>
                </span>
              </span>
            ),
          },
          {
            key: 'roles',
            label: 'الأدوار',
            render: (u) => {
              const self = u.id === session?.user.id
              return (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {options(roleLabels).map((r) => (
                    <Checkbox
                      key={r.value}
                      label={r.label}
                      checked={u.roles.includes(r.value)}
                      disabled={self && r.value === 'admin'}
                      onChange={(on) => toggleRole.mutate({ userId: u.id, role: r.value, on })}
                    />
                  ))}
                </div>
              )
            },
          },
          {
            key: 'status',
            label: 'الحالة',
            render: (u) => {
              const self = u.id === session?.user.id
              return (
                <button
                  type="button"
                  disabled={self}
                  title={self ? 'لا يمكنك إيقاف حسابك' : u.is_active ? 'اضغط للإيقاف' : 'اضغط للتفعيل'}
                  onClick={async () => {
                    if (u.is_active && !(await ask({ title: `إيقاف ${u.display_name}؟`, message: 'لن يستطيع الدخول أو قراءة أي بيانات حتى يُعاد تفعيله.', confirmLabel: 'إيقاف' }))) return
                    toggleActive.mutate({ id: u.id, active: !u.is_active })
                  }}
                  className="disabled:cursor-not-allowed"
                >
                  {u.is_active ? (
                    <Badge tone="green" dot>
                      نشط
                    </Badge>
                  ) : (
                    <Badge tone="red" dot>
                      موقوف
                    </Badge>
                  )}
                </button>
              )
            },
          },
        ]}
        rowActions={(u) => (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="تغيير كلمة المرور"
            title="تغيير كلمة المرور"
            onClick={() => {
              setNewPw('')
              setPwFor({ id: u.id, name: u.display_name })
            }}
          >
            <KeyRound className="size-4" />
          </Button>
        )}
        empty={<div className="p-10 text-center text-sm text-muted">{q ? 'لا نتائج مطابقة' : 'لا يوجد مستخدمون'}</div>}
      />

      <SidePanel
        open={creating}
        title="مستخدم جديد"
        description="يدخل المستخدم باسم الدخول وكلمة المرور"
        dirty={createDirty}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button loading={create.isPending} onClick={submitCreate}>
              إنشاء
            </Button>
            <Button variant="secondary" onClick={async () => (await confirmDiscard(createDirty)) && setCreating(false)}>
              إلغاء
            </Button>
          </>
        }
      >
        <Section title="بيانات الدخول">
          <Field label="الاسم الظاهر" required error={errors.display_name}>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} aria-invalid={Boolean(errors.display_name)} />
          </Field>
          <Field label="اسم الدخول" required hint="حروف إنجليزية صغيرة وأرقام، مثل: ali.salem" error={errors.username}>
            <Input dir="ltr" value={form.username} autoComplete="off" onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} aria-invalid={Boolean(errors.username)} />
          </Field>
          <Field label="كلمة المرور" required hint="8 أحرف على الأقل" error={errors.password}>
            <Input dir="ltr" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-invalid={Boolean(errors.password)} />
          </Field>
        </Section>
        <Section title="الصلاحيات">
          <Field label="الأدوار" group required error={errors.roles}>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {options(roleLabels).map((r) => (
                <Checkbox
                  key={r.value}
                  label={r.label}
                  checked={form.roles.includes(r.value)}
                  onChange={(on) => setForm({ ...form, roles: on ? [...form.roles, r.value] : form.roles.filter((x) => x !== r.value) })}
                />
              ))}
            </div>
          </Field>
        </Section>
      </SidePanel>

      <SidePanel
        open={pwFor !== null}
        title="كلمة مرور جديدة"
        description={pwFor?.name}
        dirty={Boolean(newPw)}
        onClose={() => setPwFor(null)}
        footer={
          <>
            <Button loading={setPassword.isPending} disabled={newPw.length < 8} onClick={() => setPassword.mutate()}>
              حفظ
            </Button>
            <Button variant="secondary" onClick={() => setPwFor(null)}>
              إلغاء
            </Button>
          </>
        }
      >
        <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
          <Input dir="ltr" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
      </SidePanel>
    </div>
  )
}
