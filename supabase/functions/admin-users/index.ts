// إدارة المستخدمين: إنشاء مستخدم وتغيير كلمة المرور. للمدير فقط.
// يتحقق من هوية المستدعي بتوكنه، ثم ينفذ بمفتاح الخادم الذي لا يصل للمتصفح أبداً.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ROLES = ['admin', 'accountant', 'engineer', 'supervisor']
const EMAIL_DOMAIN = 'rikaz.local'

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'طريقة غير مسموحة' })

  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: isAdmin, error: roleError } = await caller.rpc('is_admin')
  if (roleError || !isAdmin) return reply(403, { error: 'هذه العملية للمدير فقط' })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))

  if (body.action === 'create') {
    const username = String(body.username ?? '').trim().toLowerCase()
    const displayName = String(body.display_name ?? '').trim()
    const password = String(body.password ?? '')
    const roles: string[] = Array.isArray(body.roles) ? body.roles.filter((r: string) => ROLES.includes(r)) : []
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return reply(400, { error: 'اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً' })
    if (!displayName) return reply(400, { error: 'الاسم مطلوب' })
    if (password.length < 8) return reply(400, { error: 'كلمة المرور 8 أحرف على الأقل' })

    const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) return reply(409, { error: 'اسم المستخدم مستخدم مسبقاً' })

    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    })
    if (error) return reply(400, { error: error.message })
    if (roles.length) {
      const r = await admin.from('user_roles').insert(roles.map((role) => ({ user_id: data.user.id, role })))
      if (r.error) return reply(400, { error: r.error.message })
    }
    return reply(200, { id: data.user.id })
  }

  if (body.action === 'set_password') {
    const password = String(body.password ?? '')
    if (password.length < 8) return reply(400, { error: 'كلمة المرور 8 أحرف على الأقل' })
    const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { password })
    if (error) return reply(400, { error: error.message })
    return reply(200, { ok: true })
  }

  return reply(400, { error: 'عملية غير معروفة' })
})
