import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppLayout } from './components/AppLayout'
import { Spinner } from './components/ui'
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
  CatalogPage, ClientsPage, EmployeesPage, EngineersPage, ExpenseCategoriesPage, SuppliersPage, TechniciansPage, TechnicianTypesPage, UnitsPage,
} from './pages/masterData'

const pages: Record<string, () => React.ReactElement> = {
  '/': DashboardPage,
  '/clients': ClientsPage,
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

function Guard({ roles, children }: { roles?: AppRole[]; children: React.ReactElement }) {
  const { hasRole } = useAuth()
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { session, loading, roles } = useAuth()

  if (loading) return <Spinner />
  if (!session)
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  if (!roles.length)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4 text-center text-sm text-stone-600">
        حسابك لا يملك أي دور بعد. اطلب من المدير تحديد صلاحياتك.
      </div>
    )

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
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
