import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppLayout } from './components/AppLayout'
import { Button, Card, EmptyState, Spinner } from './components/ui'
import { allNavItems } from './nav'
import type { AppRole } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { TreasuriesPage } from './pages/TreasuriesPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'
import { AuditPage } from './pages/AuditPage'
import {
  CatalogPage, ClientsListPage, EmployeesPage, EngineersPage, ExpenseCategoriesPage, SuppliersPage, TechniciansPage, TechnicianTypesPage, UnitsPage,
} from './pages/masterData'
import { UserX } from 'lucide-react'

const pages: Record<string, () => React.ReactElement> = {
  '/': DashboardPage,
  '/clients': ClientsListPage,
  '/suppliers': SuppliersPage,
  '/technicians': TechniciansPage,
  '/employees': EmployeesPage,
  '/engineers': EngineersPage,
  '/treasuries': TreasuriesPage,
  '/catalog': CatalogPage,
  '/units': UnitsPage,
  '/technician-types': TechnicianTypesPage,
  '/expense-categories': ExpenseCategoriesPage,
  '/users': UsersPage,
  '/audit': AuditPage,
  '/settings': SettingsPage,
}

const PrintPage = lazy(() => import('./print/PrintPage'))

function Guard({ roles, children }: { roles?: AppRole[]; children: React.ReactElement }) {
  const { hasRole } = useAuth()
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { session, loading, roles, profile, signOut } = useAuth()

  if (loading) return <Spinner />
  if (!session)
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  if (!roles.length || profile?.is_active === false)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="max-w-sm">
          <EmptyState
            icon={UserX}
            title={profile?.is_active === false ? 'حسابك موقوف' : 'حسابك بلا صلاحيات'}
            action={
              <Button variant="secondary" onClick={() => signOut()}>
                تسجيل الخروج
              </Button>
            }
          >
            {profile?.is_active === false ? 'تواصل مع المدير لإعادة تفعيل حسابك.' : 'اطلب من المدير تحديد دورك في المنظومة.'}
          </EmptyState>
        </Card>
      </div>
    )

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/print/:kind/:id"
        element={
          <Suspense fallback={<Spinner />}>
            <PrintPage />
          </Suspense>
        }
      />
      <Route element={<AppLayout />}>
        {allNavItems.map((item) => {
          const Page = (!item.stage && pages[item.path]) || ComingSoonPage
          return (
            <Route
              key={item.path}
              path={item.path}
              element={
                <Guard roles={item.roles}>
                  <Page />
                </Guard>
              }
            />
          )
        })}
        <Route path="*" element={<ComingSoonPage />} />
      </Route>
    </Routes>
  )
}
