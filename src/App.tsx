import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { applyThemeColor } from "@/lib/themeColors";
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
import ProjectCustody from "./pages/ProjectCustody";
import Custody from "./pages/Custody";
import CustodyDetail from "./pages/CustodyDetail";
import ProjectPhases from "./pages/ProjectPhases";
import ProjectPayments from "./pages/ProjectPayments";
import ProjectContracts from "./pages/ProjectContracts";
import ContractClauseTemplates from "./pages/ContractClauseTemplates";
import Treasuries from "./pages/Treasuries";
import TreasuryDetail from "./pages/TreasuryDetail";
import ClientActivities from "./pages/ClientActivities";
import AuditLog from "./pages/AuditLog";
import AccountantDashboard from "./pages/AccountantDashboard";
import CashFlow from "./pages/CashFlow";
import RiskRegister from "./pages/RiskRegister";
import Inventory from "./pages/Inventory";
import ProjectSchedule from "./pages/ProjectSchedule";
import QualityControl from "./pages/QualityControl";
import VariationOrders from "./pages/VariationOrders";
import CalendarPage from "./pages/Calendar";
import InvoiceControl from "./pages/InvoiceControl";
import Gallery from "./pages/Gallery";
import DatabaseManager from "./pages/DatabaseManager";
import OfflineSetup from "./pages/OfflineSetup";
import SupabaseDataManager from "./pages/SupabaseDataManager";

const queryClient = new QueryClient();

const getDefaultTheme = (): string => {
  const saved = localStorage.getItem("default-theme");
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "dark";
};

// Load and apply saved theme color from DB
const loadThemeColor = async () => {
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("theme_color")
      .limit(1)
      .maybeSingle();
    if (data?.theme_color) {
      // Small delay to ensure dark/light class is applied first
      setTimeout(() => applyThemeColor(data.theme_color), 50);
    }
  } catch {}
};

const App = () => {
  useEffect(() => {
    loadThemeColor();
    // Re-apply on theme class changes
    const observer = new MutationObserver(() => {
      loadThemeColor();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
  <ThemeProvider attribute="class" defaultTheme={getDefaultTheme()} enableSystem={true}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
                <Route path="projects/client/:clientId" element={<ClientProjects />} />
                <Route path="projects/new" element={<ManageProject />} />
                <Route path="projects/:id" element={<ManageProject />} />
                <Route path="projects/:id/edit" element={<ManageProject />} />
                <Route path="projects/:id/items" element={<ProjectItems />} />
                <Route path="projects/:id/purchases" element={<ProjectPurchases />} />
                <Route path="projects/:id/progress" element={<ProjectProgress />} />
                <Route path="projects/:id/report" element={<ProjectReport />} />
                <Route path="projects/:id/equipment" element={<ProjectEquipmentRentals />} />
                <Route path="projects/:id/expenses" element={<ProjectExpenses />} />
                <Route path="projects/:id/phases" element={<ProjectPhases />} />
                <Route path="projects/:id/custody" element={<ProjectCustody />} />
                <Route path="projects/:id/contracts" element={<ProjectContracts />} />
                <Route path="projects/:id/phases/:phaseId/items" element={<ProjectItems />} />
                <Route path="projects/:id/phases/:phaseId/purchases" element={<ProjectPurchases />} />
                <Route path="projects/:id/phases/:phaseId/expenses" element={<ProjectExpenses />} />
                <Route path="projects/:id/phases/:phaseId/equipment" element={<ProjectEquipmentRentals />} />
                <Route path="projects/:id/payments" element={<ProjectPayments />} />
                <Route path="rentals" element={<ProjectsWithRentals />} />
                <Route path="project-expenses" element={<AllProjectExpenses />} />
                <Route path="custody" element={<Custody />} />
                <Route path="custody/:id" element={<CustodyDetail />} />
                <Route path="employees" element={<Employees />} />
                <Route path="general-items" element={<GeneralItems />} />
                <Route path="measurement-types" element={<MeasurementTypes />} />
                <Route path="equipment" element={<Equipment />} />
                <Route path="equipment/:id" element={<EquipmentDetail />} />
                <Route path="contracts" element={<Contracts />} />
                <Route path="contracts/new" element={<CreateContract />} />
                <Route path="contracts/:id" element={<CreateContract />} />
                <Route path="clients" element={<Clients />} />
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
                <Route path="print-design" element={<PrintDesign />} />
                <Route path="contract-templates" element={<ContractClauseTemplates />} />
                <Route path="treasuries" element={<Treasuries />} />
                <Route path="treasuries/:id" element={<TreasuryDetail />} />
                <Route path="client-activities" element={<ClientActivities />} />
                <Route path="audit-log" element={<AuditLog />} />
                <Route path="cash-flow" element={<CashFlow />} />
                <Route path="risk-register" element={<RiskRegister />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="schedule" element={<ProjectSchedule />} />
                <Route path="projects/:id/schedule" element={<ProjectSchedule />} />
                <Route path="quality" element={<QualityControl />} />
                <Route path="projects/:id/quality" element={<QualityControl />} />
                <Route path="variation-orders" element={<VariationOrders />} />
                <Route path="projects/:id/variation-orders" element={<VariationOrders />} />
                <Route path="projects/:id/risk-register" element={<RiskRegister />} />
                <Route path="invoice-control" element={<InvoiceControl />} />
                <Route path="gallery" element={<Gallery />} />
                <Route path="database-manager" element={<DatabaseManager />} />
                <Route path="supabase-manager" element={<SupabaseDataManager />} />
                <Route path="offline-setup" element={<OfflineSetup />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
