import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Button, ErrorState, Field, Input } from '@/components/ui'
import { errorMessage } from '@/lib/supabase'

// خطوط معمارية خفيفة للوحة الهوية (لا تُعرض الشركة قبل الدخول لأن الإعدادات محمية)
function BlueprintPattern() {
  return (
    <svg aria-hidden className="absolute inset-0 size-full text-white/[0.07]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <g fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sand-300/30">
        <path d="M60 520 L60 300 L200 220 L340 300 L340 520 Z" />
        <path d="M120 520 L120 400 L180 400 L180 520" />
        <path d="M240 340 h60 v50 h-60 z" />
        <path d="M380 520 L380 180 L470 130 L560 180 L560 520" />
        <path d="M410 230 h40 v40 h-40 z M490 230 h40 v40 h-40 z M410 310 h40 v40 h-40 z M490 310 h40 v40 h-40 z" />
        <path d="M20 520 H620" />
      </g>
    </svg>
  )
}

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <BlueprintPattern />
        <div className="absolute inset-0 bg-linear-to-t from-brand-950 via-brand-950/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12 text-brand-100">
          <div className="flex items-center gap-3">
            <span className="font-display flex size-11 items-center justify-center rounded-xl bg-sand-400 text-2xl font-bold text-brand-950">ر</span>
            <span className="font-display text-2xl font-semibold text-white">ركاز</span>
          </div>
          <div className="max-w-md">
            <h2 className="font-display text-3xl leading-snug font-semibold text-white">إدارة المشاريع والمال في مكان واحد</h2>
            <p className="mt-3 text-brand-200">المقاولات والتشطيبات، الزبائن والموردون والفنيون، الخزائن والعهد — بأرقام تأتي من مصدر واحد.</p>
          </div>
          <div className="text-xs text-brand-400">منظومة إدارة المقاولات والتشطيبات</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="font-display flex size-10 items-center justify-center rounded-xl bg-brand-700 text-xl font-bold text-sand-300">ر</span>
            <span className="font-display text-xl font-semibold">ركاز</span>
          </div>
          <h1 className="text-2xl font-semibold">تسجيل الدخول</h1>
          <p className="mt-1 mb-8 text-sm text-muted">أدخل اسم المستخدم وكلمة المرور للمتابعة</p>
          <form
            className="space-y-5"
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
              <Input value={login} onChange={(e) => setLogin(e.target.value)} dir="ltr" autoComplete="username" required autoFocus className="h-11" />
            </Field>
            <Field label="كلمة المرور">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="current-password" required className="h-11 pl-10" />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 left-2 -translate-y-1/2 rounded p-1.5 text-faint hover:text-ink"
                  aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error && <ErrorState message={error} />}
            <Button type="submit" loading={busy} className="h-11 w-full text-[15px]">
              {!busy && <LogIn className="size-4" />}
              دخول
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
