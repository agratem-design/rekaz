import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Card, ErrorState, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/supabase'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-bold text-brand-700 dark:text-brand-100">ركاز</h1>
        <p className="mb-6 text-sm text-stone-500">منظومة إدارة المقاولات والتشطيبات</p>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await signIn(login, password)
            } catch (err) {
              setError(errorMessage(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="اسم المستخدم أو البريد">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} dir="ltr" autoComplete="username" required autoFocus />
          </Field>
          <Field label="كلمة المرور">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="current-password" required />
          </Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" loading={busy} className="w-full">
            دخول
          </Button>
        </form>
      </Card>
    </div>
  )
}
