import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DesktopBackupNotifier } from "@/components/desktop/DesktopBackupNotifier";
import { ProjectRouteGuard } from "@/components/navigation/ProjectRouteGuard";
import { LegacyPhaseRedirect } from "@/components/navigation/LegacyPhaseRedirect";
import { LegacyEditRedirect } from "@/components/navigation/LegacyEditRedirect";
import ProjectOverviewHub from "./pages/ProjectOverviewHub";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ClientProjects from "./pages/ClientProjects";
import Contracts from "./pages/Contracts";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Suppliers from "./pages/Suppliers";
import Technicians from "./pages/Technicians";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import Transfers from "./pages/Transfers";
import SupplierDetail from "./pages/SupplierDetail";
import CreateContract from "./pages/CreateContract";
import ManageProject from "./pages/ManageProject";
import TechnicianDetail from "./pages/TechnicianDetail";
import ProjectItems from "./pages/ProjectItems";
import ProjectPurchases from "./pages/ProjectPurchases";
import ProjectProgress from "./pages/ProjectProgress";
import ProjectReport from "./pages/ProjectReport";
import GeneralItems from "./pages/GeneralItems";
import MeasurementTypes from "./pages/MeasurementTypes";
import Engineers from "./pages/Engineers";
import EngineerDetail from "./pages/EngineerDetail";
import Settings from "./pages/Settings";
import PrintDesign from "./pages/PrintDesign";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import Equipment from "./pages/Equipment";
import EquipmentDetail from "./pages/EquipmentDetail";
import ProjectEquipmentRentals from "./pages/ProjectEquipmentRentals";
import ProjectsWithRentals from "./pages/ProjectsWithRentals";
import ProjectExpenses from "./pages/ProjectExpenses";
import AllProjectExpenses from "./pages/AllProjectExpenses";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import ProjectCustody from "./pages/ProjectCustody";
import Custody from "./pages/Custody";
import CustodyDetail from "./pages/CustodyDetail";
import ProjectPhases from "./pages/ProjectPhases";
import PhaseWorkspace from "./pages/PhaseWorkspace";
import ProjectPayments from "./pages/ProjectPayments";
import ProjectContracts from "./pages/ProjectContracts";
import ContractClauseTemplates from "./pages/ContractClauseTemplates";
import Treasuries from "./pages/Treasuries";
import TreasuryDetail from "./pages/TreasuryDetail";
import ClientActivities from "./pages/ClientActivities";
import AuditLog from "./pages/AuditLog";
import AccountantDashboard from "./pages/AccountantDashboard";
import Inventory from "./pages/Inventory";
import CalendarPage from "./pages/Calendar";
import InvoiceControl from "./pages/InvoiceControl";
import ClientPayments from "./pages/ClientPayments";
import Debts from "./pages/Debts";
import DatabaseBackup from "./pages/DatabaseBackup";

const queryClient = new QueryClient();

// In Electron packaged builds (file://), standard BrowserRouter breaks on deep paths / reloads.
// We auto-detect electron/file protocol and seamlessly use HashRouter.
const isDesktopApp = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' || 
  navigator.userAgent.toLowerCase().includes('electron') ||
  Boolean((window as any).electron)
);

const AppRouter = ({ children }: { children: React.ReactNode }) => {
  if (isDesktopApp) {
    return <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</HashRouter>;
  }
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</BrowserRouter>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <DesktopBackupNotifier />
        <AppRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="accountant" element={<AccountantDashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/contracting" element={<Projects type="contracting" />} />
              <Route path="projects/finishing" element={<Projects type="finishing" />} />
              <Route path="projects/client/:clientId" element={<ClientProjects />} />
              <Route path="projects/new" element={<ManageProject />} />
              <Route path="projects/:id" element={<ProjectRouteGuard section="phases"><ProjectPhases /></ProjectRouteGuard>} />
              <Route path="projects/:id/overview" element={<ProjectRouteGuard section="overview"><ProjectOverviewHub /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases" element={<ProjectRouteGuard section="phases"><ProjectPhases /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId" element={<ProjectRouteGuard section="phases"><PhaseWorkspace /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId/items" element={<ProjectRouteGuard section="items"><ProjectItems /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId/purchases" element={<ProjectRouteGuard section="purchases"><ProjectPurchases /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId/expenses" element={<ProjectRouteGuard section="expenses"><ProjectExpenses /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId/equipment" element={<ProjectRouteGuard section="equipment"><ProjectEquipmentRentals /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId/progress" element={<ProjectRouteGuard section="progress"><ProjectProgress /></ProjectRouteGuard>} />
              <Route path="projects/:id/phases/:phaseId/labor" element={<ProjectRouteGuard section="progress"><ProjectProgress /></ProjectRouteGuard>} />
              <Route path="projects/:id/items" element={<ProjectRouteGuard section="items"><ProjectItems /></ProjectRouteGuard>} />
              <Route path="projects/:id/purchases" element={<ProjectRouteGuard section="purchases"><ProjectPurchases /></ProjectRouteGuard>} />
              <Route path="projects/:id/expenses" element={<ProjectRouteGuard section="expenses"><ProjectExpenses /></ProjectRouteGuard>} />
              <Route path="projects/:id/payments" element={<ProjectRouteGuard section="payments"><ProjectPayments /></ProjectRouteGuard>} />
              <Route path="projects/:id/progress" element={<ProjectRouteGuard section="progress"><ProjectProgress /></ProjectRouteGuard>} />
              <Route path="projects/:id/equipment" element={<ProjectRouteGuard section="equipment"><ProjectEquipmentRentals /></ProjectRouteGuard>} />
              <Route path="projects/:id/contracts" element={<ProjectRouteGuard section="contracts"><ProjectContracts /></ProjectRouteGuard>} />
              <Route path="projects/:id/report" element={<ProjectRouteGuard section="report"><ProjectReport /></ProjectRouteGuard>} />
              <Route path="projects/:id/settings" element={<ProjectRouteGuard section="settings"><ManageProject /></ProjectRouteGuard>} />
              <Route path="projects/:id/edit" element={<LegacyEditRedirect />} />
              <Route path="client-payments" element={<ClientPayments />} />
              <Route path="rentals" element={<ProjectsWithRentals />} />
              <Route path="project-expenses" element={<AllProjectExpenses />} />
              <Route path="custody" element={<Custody />} />
              <Route path="custody/:id" element={<CustodyDetail />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employees/:id" element={<EmployeeDetail />} />
              <Route path="general-items" element={<GeneralItems />} />
              <Route path="measurement-types" element={<MeasurementTypes />} />
              <Route path="equipment" element={<Equipment />} />
              <Route path="equipment/:id" element={<EquipmentDetail />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="contracts/new" element={<CreateContract />} />
              <Route path="contracts/:id" element={<CreateContract />} />
              <Route path="clients" element={<Clients />} />
              <Route path="debts" element={<Debts />} />
              <Route path="clients/:id" element={<ClientDetail />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/:id" element={<SupplierDetail />} />
              <Route path="suppliers/:id/projects/:projectId" element={<SupplierDetail />} />
              <Route path="technicians" element={<Technicians />} />
              <Route path="technicians/:id" element={<TechnicianDetail />} />
              <Route path="engineers" element={<Engineers />} />
              <Route path="engineers/:id" element={<EngineerDetail />} />
              <Route path="income" element={<Income />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="transfers" element={<Transfers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="database-backup" element={<DatabaseBackup />} />
              <Route path="print-design" element={<PrintDesign />} />
              <Route path="contract-templates" element={<ContractClauseTemplates />} />
              <Route path="treasuries" element={<Treasuries />} />
              <Route path="treasuries/:id" element={<TreasuryDetail />} />
              <Route path="client-activities" element={<ClientActivities />} />
              <Route path="audit-log" element={<AuditLog />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="invoice-control" element={<InvoiceControl />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
