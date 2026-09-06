import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { financialRpc, invalidateFinancialQueries } from "@/lib/financialMutations";
import { HierarchicalTreasurySelect } from "@/components/treasury/HierarchicalTreasurySelect";
import { openSalarySlipPrintWindow } from "@/lib/salarySlipPrint";
import { openReceiptPrintWindow } from "@/lib/printStyles";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  Briefcase,
  Building2,
  Calendar,
  Banknote,
  Edit,
  Trash2,
  LayoutGrid,
  List,
  Wallet,
  ShieldCheck,
  Printer,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Receipt,
  ExternalLink,
  DollarSign,
  Layers,
} from "lucide-react";

interface Employee {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  salary: number | null;
  notes: string | null;
  created_at: string;
}

interface PayrollRecord {
  id: string;
  title: string;
  month: number;
  year: number;
  status: string;
  total_basic_salaries: number;
  total_allowances: number;
  total_deductions: number;
  total_advances_deducted: number;
  total_net_salaries: number;
  notes: string | null;
  created_at: string;
}

interface PayrollSlipRecord {
  id: string;
  payroll_id: string;
  employee_id: string;
  basic_salary: number;
  allowances: number;
  deductions: number;
  advance_deduction: number;
  net_salary: number;
  status: string;
  treasury_id: string | null;
  disbursement_date: string | null;
  notes: string | null;
  created_at: string;
  employee?: { id: string; name: string; department: string | null; position: string | null; phone: string | null } | null;
  treasury?: { id: string; name: string } | null;
}

interface AdvanceRecord {
  id: string;
  employee_id: string;
  amount: number;
  monthly_deduction: number | null;
  paid_back_amount: number;
  remaining_amount: number;
  disbursement_date: string;
  treasury_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  employee?: { id: string; name: string; department: string | null } | null;
  treasury?: { id: string; name: string } | null;
}

interface CustodyRecord {
  id: string;
  project_id: string | null;
  holder_type: string;
  employee_id: string | null;
  amount: number;
  spent_amount: number;
  remaining_amount: number;
  date: string;
  status: string;
  treasury_id: string | null;
  notes: string | null;
  created_at: string;
  employee?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  treasury?: { id: string; name: string } | null;
}

interface Treasury {
  id: string;
  name: string;
  balance: number;
  treasury_type: string;
  project_category: string | null;
  parent_id?: string | null;
}

interface Project {
  id: string;
  name: string;
}

const departments = [
  { value: "administration", label: "الإدارة" },
  { value: "accounting", label: "المحاسبة" },
  { value: "hr", label: "الموارد البشرية" },
  { value: "operations", label: "العمليات" },
  { value: "logistics", label: "اللوجستيات" },
  { value: "other", label: "أخرى" },
];

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export default function Employees() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Active Tab State
  const [activeTab, setActiveTab] = useState("directory");

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);

  // Modals Open States
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isGeneratePayrollDialogOpen, setIsGeneratePayrollDialogOpen] = useState(false);
  const [isPaySlipDialogOpen, setIsPaySlipDialogOpen] = useState(false);
  const [selectedSlipToPay, setSelectedSlipToPay] = useState<PayrollSlipRecord | null>(null);

  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [isRepayAdvanceDialogOpen, setIsRepayAdvanceDialogOpen] = useState(false);
  const [selectedAdvanceToRepay, setSelectedAdvanceToRepay] = useState<AdvanceRecord | null>(null);

  const [isCustodyDialogOpen, setIsCustodyDialogOpen] = useState(false);
  const [isReturnCustodyDialogOpen, setIsReturnCustodyDialogOpen] = useState(false);
  const [selectedCustodyToReturn, setSelectedCustodyToReturn] = useState<CustodyRecord | null>(null);

  // Forms
  const [employeeFormData, setEmployeeFormData] = useState({
    name: "",
    phone: "",
    email: "",
    position: "",
    department: "",
    hire_date: "",
    salary: "",
    notes: "",
  });

  const currentDate = new Date();
  const [payrollForm, setPayrollForm] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    title: `مسير رواتب ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
  });

  const [paySlipForm, setPaySlipForm] = useState({
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [advanceForm, setAdvanceForm] = useState({
    employee_id: "",
    amount: "",
    monthly_deduction: "",
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [repayAdvanceForm, setRepayAdvanceForm] = useState({
    amount: "",
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [custodyForm, setCustodyForm] = useState({
    employee_id: "",
    project_id: "",
    amount: "",
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [returnCustodyForm, setReturnCustodyForm] = useState({
    amount: "",
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Queries
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Employee[];
    },
  });

  const { data: payrolls = [], isLoading: isLoadingPayrolls } = useQuery({
    queryKey: ["employee_payrolls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_payrolls")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data as PayrollRecord[];
    },
  });

  const { data: slips = [], isLoading: isLoadingSlips } = useQuery({
    queryKey: ["all_payroll_slips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_payroll_slips")
        .select(`
          *,
          employee:employees(id, name, department, position, phone),
          treasury:treasuries(id, name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PayrollSlipRecord[];
    },
  });

  const { data: advances = [], isLoading: isLoadingAdvances } = useQuery({
    queryKey: ["all_employee_advances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_advances")
        .select(`
          *,
          employee:employees(id, name, department),
          treasury:treasuries(id, name)
        `)
        .order("disbursement_date", { ascending: false });
      if (error) throw error;
      return data as AdvanceRecord[];
    },
  });

  const { data: custodies = [], isLoading: isLoadingCustodies } = useQuery({
    queryKey: ["all_employee_custodies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_custody")
        .select(`
          *,
          employee:employees(id, name),
          project:projects(id, name),
          treasury:treasuries(id, name)
        `)
        .eq("holder_type", "employee")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as CustodyRecord[];
    },
  });

  const { data: treasuries = [] } = useQuery({
    queryKey: ["treasuries-active-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, project_category, parent_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Treasury[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["active-projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handlePrintAdvanceReceipt = (adv: AdvanceRecord) => {
    openReceiptPrintWindow(
      {
        receiptNumber: `ADV-${adv.id.slice(0, 8)}`,
        date: adv.disbursement_date,
        type: "advance",
        amount: Number(adv.amount),
        paidToOrBy: adv.employee?.name || "الموظف",
        description: `سند صرف سلفة مالية للموظف: ${adv.employee?.name || ''}`,
        treasuryName: adv.treasury?.name,
        notes: adv.notes || undefined,
      },
      companySettings
    );
  };

  const handlePrintCustodyReceipt = (c: CustodyRecord) => {
    openReceiptPrintWindow(
      {
        receiptNumber: `CUST-${c.id.slice(0, 8)}`,
        date: c.date,
        type: "custody",
        amount: Number(c.amount),
        paidToOrBy: c.employee?.name || "الموظف",
        description: `سند صرف عهدة مالية: ${c.project?.name || 'عهدة عامة'}`,
        projectName: c.project?.name,
        treasuryName: c.treasury?.name,
        notes: c.notes || undefined,
      },
      companySettings
    );
  };

  // KPI Calculations
  const totalEmployeesCount = employees.length;
  const totalBasicSalaries = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
  const totalActiveAdvances = advances
    .filter((a) => a.status === "active")
    .reduce((sum, a) => sum + (Number(a.remaining_amount) || 0), 0);
  const totalActiveCustody = custodies
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (Number(c.remaining_amount) || 0), 0);

  // Mutations
  const addEmployeeMutation = useMutation({
    mutationFn: async (data: typeof employeeFormData) => {
      const { error } = await supabase.from("employees").insert({
        name: data.name.trim(),
        phone: data.phone.trim() || null,
        email: data.email.trim() || null,
        position: data.position.trim() || null,
        department: data.department || null,
        hire_date: data.hire_date || null,
        salary: data.salary ? parseFloat(data.salary) : null,
        notes: data.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تم إضافة الموظف بنجاح");
      resetEmployeeForm();
      setIsEmployeeDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "فشل في إضافة الموظف"),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof employeeFormData }) => {
      const { error } = await supabase
        .from("employees")
        .update({
          name: data.name.trim(),
          phone: data.phone.trim() || null,
          email: data.email.trim() || null,
          position: data.position.trim() || null,
          department: data.department || null,
          hire_date: data.hire_date || null,
          salary: data.salary ? parseFloat(data.salary) : null,
          notes: data.notes.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تم تحديث بيانات الموظف بنجاح");
      resetEmployeeForm();
      setIsEmployeeDialogOpen(false);
      setEditingEmployee(null);
    },
    onError: (err: any) => toast.error(err.message || "فشل في تحديث البيانات"),
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تم حذف الموظف بنجاح");
    },
    onError: (err: any) => toast.error(err.message || "فشل في حذف الموظف"),
  });

  // Payroll Mutations
  const generatePayrollMutation = useMutation({
    mutationFn: async (vars: typeof payrollForm) => {
      return await financialRpc("generate_monthly_payroll", {
        p_month: Number(vars.month),
        p_year: Number(vars.year),
        p_title: vars.title,
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["employee_payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["all_payroll_slips"] });
      toast.success("تم توليد مسير الرواتب وربط أقساط السلف بنجاح");
      setIsGeneratePayrollDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "فشل في توليد مسير الرواتب"),
  });

  const disburseSlipMutation = useMutation({
    mutationFn: async (vars: typeof paySlipForm) => {
      if (!selectedSlipToPay) throw new Error("لم يتم تحديد القسيمة");
      if (!vars.treasury_id) throw new Error("يرجى اختيار خزينة الصرف");

      return await financialRpc("disburse_payroll_slip", {
        p_slip_id: selectedSlipToPay.id,
        p_treasury_id: vars.treasury_id,
        p_date: vars.date || new Date().toISOString().split("T")[0],
        p_notes: vars.notes || null,
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["all_payroll_slips"] });
      queryClient.invalidateQueries({ queryKey: ["employee_payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["all_employee_advances"] });
      toast.success("تم صرف قسيمة الراتب وخصم الخزينة وسداد قسط السلفة بنجاح");
      setIsPaySlipDialogOpen(false);
      setSelectedSlipToPay(null);
    },
    onError: (err: any) => toast.error(err.message || "فشل في صرف قسيمة الراتب"),
  });

  // Advance Mutations
  const disburseAdvanceMutation = useMutation({
    mutationFn: async (vars: typeof advanceForm) => {
      if (!vars.employee_id) throw new Error("يرجى اختيار الموظف");
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ صحيح للسلفة");
      if (!vars.treasury_id) throw new Error("يرجى اختيار الخزينة المخصوم منها");
      const monthlyDeduction = vars.monthly_deduction ? parseFloat(vars.monthly_deduction) : null;

      return await financialRpc("disburse_employee_advance", {
        p_employee_id: vars.employee_id,
        p_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_monthly_deduction: monthlyDeduction,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["all_employee_advances"] });
      toast.success("تم صرف السلفة وخصم المبلغ من الخزينة بنجاح");
      setIsAdvanceDialogOpen(false);
      setAdvanceForm({
        employee_id: "",
        amount: "",
        monthly_deduction: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في صرف السلفة"),
  });

  const repayAdvanceMutation = useMutation({
    mutationFn: async (vars: typeof repayAdvanceForm) => {
      if (!selectedAdvanceToRepay) throw new Error("لم يتم تحديد السلفة");
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ سداد صحيح");
      if (amount > selectedAdvanceToRepay.remaining_amount) {
        throw new Error(`مبلغ السداد يتجاوز الرصيد المتبقي للسلفة (${formatCurrencyLYD(selectedAdvanceToRepay.remaining_amount)})`);
      }
      if (!vars.treasury_id) throw new Error("يرجى اختيار الخزينة المودع فيها");

      return await financialRpc("repay_employee_advance", {
        p_advance_id: selectedAdvanceToRepay.id,
        p_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["all_employee_advances"] });
      toast.success("تم تسجيل السداد وإيداع المبلغ في الخزينة بنجاح");
      setIsRepayAdvanceDialogOpen(false);
      setSelectedAdvanceToRepay(null);
      setRepayAdvanceForm({
        amount: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في سداد السلفة"),
  });

  // Custody Mutations
  const issueCustodyMutation = useMutation({
    mutationFn: async (vars: typeof custodyForm) => {
      if (!vars.employee_id) throw new Error("يرجى اختيار الموظف");
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ صحيح للعهدة");
      if (!vars.treasury_id) throw new Error("يرجى تحديد الخزينة المنصرف منها");

      return await financialRpc("issue_employee_custody", {
        p_holder_type: "employee",
        p_holder_id: vars.employee_id,
        p_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_project_id: vars.project_id || null,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["all_employee_custodies"] });
      toast.success("تم صرف العهدة وخصمها من الخزينة بنجاح");
      setIsCustodyDialogOpen(false);
      setCustodyForm({
        employee_id: "",
        project_id: "",
        amount: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في صرف العهدة"),
  });

  const returnCustodyMutation = useMutation({
    mutationFn: async (vars: typeof returnCustodyForm) => {
      if (!selectedCustodyToReturn) throw new Error("لم يتم تحديد العهدة");
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ رد صحيح");
      if (amount > selectedCustodyToReturn.remaining_amount) {
        throw new Error(`مبلغ الرد يتجاوز المتبقي من العهدة (${formatCurrencyLYD(selectedCustodyToReturn.remaining_amount)})`);
      }
      if (!vars.treasury_id) throw new Error("يرجى تحديد الخزينة المودع فيها");

      return await financialRpc("settle_custody_cash_return", {
        p_custody_id: selectedCustodyToReturn.id,
        p_return_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["all_employee_custodies"] });
      toast.success("تم رد العهدة النقدية وإيداعها في الخزينة بنجاح");
      setIsReturnCustodyDialogOpen(false);
      setSelectedCustodyToReturn(null);
      setReturnCustodyForm({
        amount: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في رد العهدة"),
  });

  // Helpers
  const resetEmployeeForm = () => {
    setEmployeeFormData({
      name: "",
      phone: "",
      email: "",
      position: "",
      department: "",
      hire_date: "",
      salary: "",
      notes: "",
    });
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeFormData({
      name: emp.name,
      phone: emp.phone || "",
      email: emp.email || "",
      position: emp.position || "",
      department: emp.department || "",
      hire_date: emp.hire_date || "",
      salary: emp.salary?.toString() || "",
      notes: emp.notes || "",
    });
    setIsEmployeeDialogOpen(true);
  };

  const handlePrintSlip = (slip: PayrollSlipRecord) => {
    const parentPayroll = payrolls.find((p) => p.id === slip.payroll_id);
    openSalarySlipPrintWindow(
      {
        slipNumber: slip.id.substring(0, 8).toUpperCase(),
        month: parentPayroll?.month || 1,
        year: parentPayroll?.year || new Date().getFullYear(),
        payrollTitle: parentPayroll?.title || "مسير رواتب",
        employeeName: slip.employee?.name || "موظف",
        department: departments.find((d) => d.value === slip.employee?.department)?.label || slip.employee?.department,
        position: slip.employee?.position,
        phone: slip.employee?.phone,
        basicSalary: slip.basic_salary,
        allowances: slip.allowances,
        deductions: slip.deductions,
        advanceDeduction: slip.advance_deduction,
        netSalary: slip.net_salary,
        treasuryName: slip.treasury?.name,
        disbursementDate: slip.disbursement_date,
        status: slip.status,
        notes: slip.notes,
      },
      companySettings
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.phone?.includes(searchQuery);
    const matchesDept = departmentFilter === "all" || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const getDepartmentLabel = (val: string | null) => {
    if (!val) return null;
    return departments.find((d) => d.value === val)?.label || val;
  };

  const activePayrollSlips = useMemo(() => {
    if (!selectedPayrollId) return slips;
    return slips.filter((s) => s.payroll_id === selectedPayrollId);
  }, [slips, selectedPayrollId]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            إدارة الموظفين والرواتب والعهد
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            منظومة متكاملة لبيانات الموظفين، مسيرات الرواتب الشهرية، السلف والاستقطاعات، والعهد المالية
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGeneratePayrollDialogOpen(true)}
            className="gap-1.5 cursor-pointer border-primary/30 hover:bg-primary/10"
          >
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <span>توليد مسير رواتب</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCustodyDialogOpen(true)}
            className="gap-1.5 cursor-pointer border-amber-600/30 text-amber-700 dark:text-amber-400 hover:bg-amber-600/10"
          >
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span>صرف عهدة</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdvanceDialogOpen(true)}
            className="gap-1.5 cursor-pointer border-blue-600/30 text-blue-700 dark:text-blue-400 hover:bg-blue-600/10"
          >
            <Wallet className="h-4 w-4 text-blue-600" />
            <span>صرف سلفة</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingEmployee(null);
              resetEmployeeForm();
              setIsEmployeeDialogOpen(true);
            }}
            className="gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة موظف</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الموظفين</span>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-foreground font-mono">{totalEmployeesCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">كادر العمل الإداري والميداني</p>
        </Card>

        <Card className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الرواتب الأساسية</span>
            <div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-600">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-foreground font-mono" dir="ltr">
            {formatCurrencyLYD(totalBasicSalaries)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">المستحق التعاقدي الشهري</p>
        </Card>

        <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">رصيد السلف القائمة</span>
            <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-destructive font-mono" dir="ltr">
            {formatCurrencyLYD(totalActiveAdvances)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">مبالغ قيد الاستقطاع الشهري</p>
        </Card>

        <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">العهد المالية النشطة</span>
            <div className="p-2 bg-amber-600/10 rounded-lg text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600 font-mono" dir="ltr">
            {formatCurrencyLYD(totalActiveCustody)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">عهد نقدية تحت تسوية المشاريع</p>
        </Card>
      </div>

      {/* Main Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="directory" className="cursor-pointer">
            دليل الموظفين ({employees.length})
          </TabsTrigger>
          <TabsTrigger value="payroll" className="cursor-pointer">
            مسيرات الرواتب ({payrolls.length})
          </TabsTrigger>
          <TabsTrigger value="advances" className="cursor-pointer">
            السلف المالية ({advances.length})
          </TabsTrigger>
          <TabsTrigger value="custody" className="cursor-pointer">
            العهد المالية ({custodies.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: EMPLOYEES DIRECTORY ================= */}
        <TabsContent value="directory" className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث عن موظف بالاسم، المنصب أو الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 h-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40 h-10" dir="rtl">
                  <SelectValue placeholder="القسم" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("cards")}
                className="h-10 w-10 cursor-pointer"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("table")}
                className="h-10 w-10 cursor-pointer"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Directory Content */}
          {filteredEmployees.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-bold">لا يوجد موظفين مطابقين للبحث</h3>
              <p className="text-sm text-muted-foreground mb-4">يمكنك إضافة موظف جديد لتسجيل بياناته وراتبه.</p>
              <Button onClick={() => setIsEmployeeDialogOpen(true)} className="cursor-pointer">
                <Plus className="h-4 w-4 ml-1.5" />
                إضافة موظف
              </Button>
            </Card>
          ) : viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => (
                <Card key={emp.id} className="hover:shadow-md transition-shadow border-border/80 overflow-hidden">
                  <div className="h-1 bg-primary/40" />
                  <CardHeader className="pb-3 pt-4">
                    <div className="flex justify-between items-start">
                      <div className="cursor-pointer" onClick={() => navigate(`/employees/${emp.id}`)}>
                        <CardTitle className="text-base font-bold hover:text-primary transition-colors flex items-center gap-2">
                          <span>{emp.name}</span>
                        </CardTitle>
                        {emp.position && (
                          <p className="text-xs text-muted-foreground mt-0.5">{emp.position}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer"
                          onClick={() => handleEditEmployee(emp)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive cursor-pointer hover:bg-destructive/10"
                          onClick={() => deleteEmployeeMutation.mutate(emp.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {emp.department && (
                      <Badge variant="secondary" className="text-xs">
                        {getDepartmentLabel(emp.department)}
                      </Badge>
                    )}
                    <div className="space-y-1.5 text-xs">
                      {emp.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span dir="ltr">{emp.phone}</span>
                        </div>
                      )}
                      {emp.hire_date && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>تعيين: {format(new Date(emp.hire_date), "dd MMMM yyyy", { locale: ar })}</span>
                        </div>
                      )}
                      {emp.salary && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Banknote className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span className="font-semibold text-foreground font-mono">
                            الراتب: {formatCurrencyLYD(emp.salary)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        className="w-full text-xs gap-1 cursor-pointer hover:bg-primary/10"
                      >
                        <span>عرض الملف والحساب المالي</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>المنصب</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>الراتب الأساسي</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-muted/40">
                      <TableCell className="font-semibold">
                        <Link to={`/employees/${emp.id}`} className="hover:text-primary hover:underline">
                          {emp.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp.position || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {getDepartmentLabel(emp.department) || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell dir="ltr" className="text-xs font-mono text-right">{emp.phone || "-"}</TableCell>
                      <TableCell dir="ltr" className="font-mono font-semibold text-right">
                        {emp.salary ? formatCurrencyLYD(emp.salary) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="h-8 text-xs gap-1 cursor-pointer"
                          >
                            <span>الملف</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => handleEditEmployee(emp)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive cursor-pointer hover:bg-destructive/10"
                            onClick={() => deleteEmployeeMutation.mutate(emp.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ================= TAB 2: MONTHLY PAYROLLS & SLIPS ================= */}
        <TabsContent value="payroll" className="space-y-6">
          {/* Payroll Cycles Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">مسيرات الرواتب الشهرية</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">توليد المسيرات وحساب الاستقطاعات والبدلات لجميع الموظفين آلياً</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsGeneratePayrollDialogOpen(true)}
                  className="gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>توليد مسير جديد</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {payrolls.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p>لا توجد مسيرات رواتب مسجلة حتى الآن.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>عنوان المسير</TableHead>
                      <TableHead>الشهر / السنة</TableHead>
                      <TableHead>الرواتب الأساسية</TableHead>
                      <TableHead>البدلات</TableHead>
                      <TableHead>الخصومات</TableHead>
                      <TableHead>أقساط السلف</TableHead>
                      <TableHead>الصافي الإجمالي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrolls.map((pr) => {
                      const isSelected = selectedPayrollId === pr.id;
                      return (
                        <TableRow key={pr.id} className={isSelected ? "bg-primary/5 font-semibold" : ""}>
                          <TableCell className="font-bold">{pr.title}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {MONTH_NAMES[(pr.month - 1) % 12]} {pr.year}
                          </TableCell>
                          <TableCell dir="ltr" className="font-mono text-right">
                            {formatCurrencyLYD(pr.total_basic_salaries)}
                          </TableCell>
                          <TableCell dir="ltr" className="font-mono text-emerald-600 text-right">
                            +{formatCurrencyLYD(pr.total_allowances)}
                          </TableCell>
                          <TableCell dir="ltr" className="font-mono text-destructive text-right">
                            -{formatCurrencyLYD(pr.total_deductions)}
                          </TableCell>
                          <TableCell dir="ltr" className="font-mono text-amber-600 text-right">
                            -{formatCurrencyLYD(pr.total_advances_deducted)}
                          </TableCell>
                          <TableCell dir="ltr" className="font-mono font-bold text-foreground text-right">
                            {formatCurrencyLYD(pr.total_net_salaries)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={pr.status === "approved" ? "outline" : "secondary"} className={pr.status === "approved" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}>
                              {pr.status === "approved" ? "معتمد" : "مسودة"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              onClick={() => setSelectedPayrollId(isSelected ? null : pr.id)}
                              className="h-8 gap-1 text-xs cursor-pointer"
                            >
                              <span>{isSelected ? "إخفاء القسائم" : "عرض القسائم"}</span>
                              {isSelected ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Slips Details Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    قسائم الرواتب الفردية
                    {selectedPayrollId && (
                      <span className="text-xs font-normal text-muted-foreground mr-2">
                        (مفلترة حسب المسير المحدد)
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">صرف القسائم عبر الخزائن وطباعة إيصالات مفردات الراتب</p>
                </div>
                {selectedPayrollId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPayrollId(null)}
                    className="text-xs cursor-pointer"
                  >
                    عرض كل القسائم
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activePayrollSlips.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p>لا توجد قسائم لعرضها.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>القسم</TableHead>
                      <TableHead>الراتب الأساسي</TableHead>
                      <TableHead>البدلات</TableHead>
                      <TableHead>الخصومات</TableHead>
                      <TableHead>قسط السلفة</TableHead>
                      <TableHead>صافي الراتب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>خزينة الصرف</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePayrollSlips.map((slip) => (
                      <TableRow key={slip.id} className="hover:bg-muted/40">
                        <TableCell className="font-semibold">
                          <Link to={`/employees/${slip.employee?.id}`} className="hover:text-primary hover:underline">
                            {slip.employee?.name || "-"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">
                          {getDepartmentLabel(slip.employee?.department || "") || "-"}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-right">
                          {formatCurrencyLYD(slip.basic_salary)}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-emerald-600 text-right">
                          {slip.allowances > 0 ? `+${formatCurrencyLYD(slip.allowances)}` : "-"}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-destructive text-right">
                          {slip.deductions > 0 ? `-${formatCurrencyLYD(slip.deductions)}` : "-"}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-amber-600 text-right">
                          {slip.advance_deduction > 0 ? `-${formatCurrencyLYD(slip.advance_deduction)}` : "-"}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono font-bold text-foreground text-right">
                          {formatCurrencyLYD(slip.net_salary)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={slip.status === "paid" ? "outline" : "secondary"} className={slip.status === "paid" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}>
                            {slip.status === "paid" ? "تم الصرف" : "قيد الانتظار"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {slip.treasury?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {slip.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedSlipToPay(slip);
                                  setIsPaySlipDialogOpen(true);
                                }}
                                className="h-8 gap-1 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-600/10 cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>صرف</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintSlip(slip)}
                              className="h-8 gap-1 text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>قسيمة</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: ADVANCES ================= */}
        <TabsContent value="advances" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">سجل السلف المالية للموظفين</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">صرف السلف من الخزائن ومتابعة جدول السداد والاستقطاع الشهري</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAdvanceDialogOpen(true)}
                  className="gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>صرف سلفة جديدة</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {advances.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p>لا توجد سلف مسجلة حتى الآن.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>تاريخ الصرف</TableHead>
                      <TableHead>مبلغ السلفة</TableHead>
                      <TableHead>القسط الشهري</TableHead>
                      <TableHead>المسدد</TableHead>
                      <TableHead>المتبقي</TableHead>
                      <TableHead>الخزينة المخصوم منها</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((adv) => (
                      <TableRow key={adv.id} className="hover:bg-muted/40">
                        <TableCell className="font-semibold">
                          <Link to={`/employees/${adv.employee?.id}`} className="hover:text-primary hover:underline">
                            {adv.employee?.name || "-"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{adv.disbursement_date}</TableCell>
                        <TableCell dir="ltr" className="font-mono font-semibold text-right">
                          {formatCurrencyLYD(adv.amount)}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-muted-foreground text-right">
                          {adv.monthly_deduction ? formatCurrencyLYD(adv.monthly_deduction) : "كامل المبلغ"}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-emerald-600 text-right">
                          {formatCurrencyLYD(adv.paid_back_amount)}
                        </TableCell>
                        <TableCell dir="ltr" className={`font-mono font-bold text-right ${adv.remaining_amount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {formatCurrencyLYD(adv.remaining_amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {adv.treasury?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={adv.status === "active" ? "destructive" : "outline"} className={adv.status === "fully_paid" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}>
                            {adv.status === "active" ? "نشطة (قائمة)" : "مسددة بالكامل"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintAdvanceReceipt(adv)}
                              title="طباعة سند صرف السلفة"
                              className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {adv.remaining_amount > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAdvanceToRepay(adv);
                                  setRepayAdvanceForm((prev) => ({
                                    ...prev,
                                    amount: adv.remaining_amount.toString(),
                                  }));
                                  setIsRepayAdvanceDialogOpen(true);
                                }}
                                className="h-8 gap-1 text-xs border-primary/40 hover:bg-primary/10 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                                <span>سداد دفعة</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/employees/${adv.employee_id}`)}
                              className="h-8 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 4: CUSTODIES ================= */}
        <TabsContent value="custody" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">سجل العهد المالية للموظفين</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">العهد التشغيلية والميدانية المخصومة من الخزائن والمسلوبة للموظفين</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsCustodyDialogOpen(true)}
                  className="gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>صرف عهدة جديدة</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {custodies.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p>لا توجد عهد مالية مسجلة للموظفين.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف المسؤول</TableHead>
                      <TableHead>المشروع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>مبلغ العهدة</TableHead>
                      <TableHead>المصروف منها</TableHead>
                      <TableHead>المتبقي</TableHead>
                      <TableHead>خزينة الصرف</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {custodies.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/40">
                        <TableCell className="font-semibold">
                          <Link to={`/employees/${c.employee_id}`} className="hover:text-primary hover:underline">
                            {c.employee?.name || "-"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{c.project?.name || "عهدة عامة"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.date}</TableCell>
                        <TableCell dir="ltr" className="font-mono font-semibold text-right">
                          {formatCurrencyLYD(c.amount)}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-destructive text-right">
                          {formatCurrencyLYD(c.spent_amount)}
                        </TableCell>
                        <TableCell dir="ltr" className={`font-mono font-bold text-right ${c.remaining_amount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {formatCurrencyLYD(c.remaining_amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.treasury?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === "active" ? "secondary" : "outline"} className={c.status === "active" ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" : ""}>
                            {c.status === "active" ? "نشطة" : "مسواة بالكامل"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintCustodyReceipt(c)}
                              title="طباعة سند صرف العهدة"
                              className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {c.remaining_amount > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCustodyToReturn(c);
                                  setReturnCustodyForm((prev) => ({
                                    ...prev,
                                    amount: c.remaining_amount.toString(),
                                  }));
                                  setIsReturnCustodyDialogOpen(true);
                                }}
                                className="h-8 gap-1 text-xs border-amber-600/30 text-amber-700 hover:bg-amber-600/10 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                                <span>رد الفائض</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/custody/${c.id}`)}
                              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>تفاصيل</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= DIALOG 1: ADD / EDIT EMPLOYEE ================= */}
      <Dialog
        open={isEmployeeDialogOpen}
        onOpenChange={(open) => {
          setIsEmployeeDialogOpen(open);
          if (!open) {
            setEditingEmployee(null);
            resetEmployeeForm();
          }
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
            </DialogTitle>
            <DialogDescription>
              أدخل البيانات الشخصية، المسمى الوظيفي، والراتب الشهري التعاقدي المعتمد.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!employeeFormData.name.trim()) {
                toast.error("يرجى إدخال اسم الموظف");
                return;
              }
              if (editingEmployee) {
                updateEmployeeMutation.mutate({ id: editingEmployee.id, data: employeeFormData });
              } else {
                addEmployeeMutation.mutate(employeeFormData);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="emp_name">اسم الموظف *</Label>
              <Input
                id="emp_name"
                required
                value={employeeFormData.name}
                onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
                placeholder="الاسم الرباعي للموظف"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp_phone">الهاتف</Label>
                <Input
                  id="emp_phone"
                  value={employeeFormData.phone}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp_email">البريد الإلكتروني</Label>
                <Input
                  id="emp_email"
                  type="email"
                  value={employeeFormData.email}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })}
                  placeholder="example@rekaz.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp_pos">المنصب</Label>
                <Input
                  id="emp_pos"
                  value={employeeFormData.position}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, position: e.target.value })}
                  placeholder="المسمى الوظيفي"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp_dept">القسم</Label>
                <Select
                  value={employeeFormData.department}
                  onValueChange={(val) => setEmployeeFormData({ ...employeeFormData, department: val })}
                >
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {departments.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value} className="cursor-pointer">
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp_hire">تاريخ التعيين</Label>
                <Input
                  id="emp_hire"
                  type="date"
                  value={employeeFormData.hire_date}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, hire_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp_sal">الراتب الأساسي (د.ل)</Label>
                <Input
                  id="emp_sal"
                  type="number"
                  step="0.01"
                  value={employeeFormData.salary}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, salary: e.target.value })}
                  placeholder="الراتب الشهري"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp_notes">ملاحظات</Label>
              <Textarea
                id="emp_notes"
                value={employeeFormData.notes}
                onChange={(e) => setEmployeeFormData({ ...employeeFormData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={addEmployeeMutation.isPending || updateEmployeeMutation.isPending}
            >
              {editingEmployee ? "تحديث البيانات" : "إضافة الموظف"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG 2: GENERATE MONTHLY PAYROLL ================= */}
      <Dialog open={isGeneratePayrollDialogOpen} onOpenChange={setIsGeneratePayrollDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>توليد مسير رواتب شهري جديد</DialogTitle>
            <DialogDescription>
              يقوم النظام بإنشاء قسائم الرواتب لجميع الموظفين واحتساب استقطاعات أقساط السلف النشطة آلياً.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generatePayrollMutation.mutate(payrollForm);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الشهر</Label>
                <Select
                  value={payrollForm.month.toString()}
                  onValueChange={(val) => {
                    const m = parseInt(val);
                    setPayrollForm({
                      ...payrollForm,
                      month: m,
                      title: `مسير رواتب ${MONTH_NAMES[m - 1]} ${payrollForm.year}`,
                    });
                  }}
                >
                  <SelectTrigger dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {MONTH_NAMES.map((name, idx) => (
                      <SelectItem key={idx + 1} value={(idx + 1).toString()} className="cursor-pointer">
                        {name} ({idx + 1})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>السنة</Label>
                <Input
                  type="number"
                  value={payrollForm.year}
                  onChange={(e) => {
                    const y = parseInt(e.target.value) || new Date().getFullYear();
                    setPayrollForm({
                      ...payrollForm,
                      year: y,
                      title: `مسير رواتب ${MONTH_NAMES[payrollForm.month - 1]} ${y}`,
                    });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay_title">عنوان المسير *</Label>
              <Input
                id="pay_title"
                required
                value={payrollForm.title}
                onChange={(e) => setPayrollForm({ ...payrollForm, title: e.target.value })}
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
              <div>عدد الموظفين المشمولين: <span className="font-bold">{employees.length} موظف</span></div>
              <div>إجمالي الرواتب الأساسية التقديرية: <span className="font-mono font-bold">{formatCurrencyLYD(totalBasicSalaries)}</span></div>
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={generatePayrollMutation.isPending}
            >
              {generatePayrollMutation.isPending ? "جاري التوليد والربط..." : "تأكيد توليد مسير الرواتب"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG 3: DISBURSE PAYROLL SLIP ================= */}
      <Dialog open={isPaySlipDialogOpen} onOpenChange={setIsPaySlipDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>صرف قسيمة راتب الموظف</DialogTitle>
            <DialogDescription>
              يتم خصم صافي الراتب فوراً من الخزينة المحددة وتسجيل استقطاع قسط السلفة إن وُجد.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              disburseSlipMutation.mutate(paySlipForm);
            }}
            className="space-y-4"
          >
            {selectedSlipToPay && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5">
                <div className="font-bold text-sm">{selectedSlipToPay.employee?.name}</div>
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span className="font-mono">{formatCurrencyLYD(selectedSlipToPay.basic_salary)}</span>
                </div>
                {selectedSlipToPay.advance_deduction > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>خصم قسط السلفة:</span>
                    <span className="font-mono">-{formatCurrencyLYD(selectedSlipToPay.advance_deduction)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1 text-primary">
                  <span>صافي الراتب المستحق للصرف:</span>
                  <span className="font-mono text-sm">{formatCurrencyLYD(selectedSlipToPay.net_salary)}</span>
                </div>
              </div>
            )}

            <HierarchicalTreasurySelect
              value={paySlipForm.treasury_id}
              onValueChange={(val) => setPaySlipForm({ ...paySlipForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المصروف منها *"
              childLabel="الحساب / الفرع المنصرف منه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="ps_date_all">تاريخ الصرف</Label>
              <Input
                id="ps_date_all"
                type="date"
                value={paySlipForm.date}
                onChange={(e) => setPaySlipForm({ ...paySlipForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ps_notes_all">ملاحظات</Label>
              <Textarea
                id="ps_notes_all"
                placeholder="ملاحظات اختيارية..."
                value={paySlipForm.notes}
                onChange={(e) => setPaySlipForm({ ...paySlipForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={disburseSlipMutation.isPending}
            >
              {disburseSlipMutation.isPending ? "جاري الصرف والتحديث..." : "تأكيد صرف القسيمة وخصم الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG 4: DISBURSE ADVANCE ================= */}
      <Dialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>صرف سلفة مالية جديدة</DialogTitle>
            <DialogDescription>
              يتم خصم مبلغ السلفة فوراً وبشكل آمن من الخزينة وفتح حساب سلفة على الموظف.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              disburseAdvanceMutation.mutate(advanceForm);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>الموظف المستفيد *</Label>
              <Select
                value={advanceForm.employee_id}
                onValueChange={(val) => setAdvanceForm({ ...advanceForm, employee_id: val })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر الموظف..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                      {emp.name} {emp.position ? `(${emp.position})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adv_amt_glob">مبلغ السلفة (د.ل) *</Label>
                <Input
                  id="adv_amt_glob"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adv_ded_glob">القسط الشهري</Label>
                <Input
                  id="adv_ded_glob"
                  type="number"
                  step="0.01"
                  placeholder="اختياري"
                  value={advanceForm.monthly_deduction}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, monthly_deduction: e.target.value })}
                />
              </div>
            </div>

            <HierarchicalTreasurySelect
              value={advanceForm.treasury_id}
              onValueChange={(val) => setAdvanceForm({ ...advanceForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المصروف منها *"
              childLabel="الحساب / الفرع المخصوم منه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="adv_dt_glob">تاريخ الصرف</Label>
              <Input
                id="adv_dt_glob"
                type="date"
                value={advanceForm.date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adv_nt_glob">ملاحظات / أسباب السلفة</Label>
              <Textarea
                id="adv_nt_glob"
                placeholder="أسباب طلب السلفة..."
                value={advanceForm.notes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={disburseAdvanceMutation.isPending}
            >
              {disburseAdvanceMutation.isPending ? "جاري الصرف..." : "تأكيد صرف السلفة وخصم الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG 5: REPAY ADVANCE ================= */}
      <Dialog open={isRepayAdvanceDialogOpen} onOpenChange={setIsRepayAdvanceDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>سداد دفعة من السلفة نقدياً</DialogTitle>
            <DialogDescription>
              يتم إيداع المبلغ فوراً في الخزينة المختارة وتخفيض رصيد السلفة المتبقي على الموظف.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              repayAdvanceMutation.mutate(repayAdvanceForm);
            }}
            className="space-y-4"
          >
            {selectedAdvanceToRepay && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <div>الموظف: <span className="font-bold">{selectedAdvanceToRepay.employee?.name}</span></div>
                <div>إجمالي السلفة: <span className="font-mono">{formatCurrencyLYD(selectedAdvanceToRepay.amount)}</span></div>
                <div>الرصيد المتبقي: <span className="font-mono font-bold text-destructive">{formatCurrencyLYD(selectedAdvanceToRepay.remaining_amount)}</span></div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rep_amt_glob">المبلغ المسدد (د.ل) *</Label>
              <Input
                id="rep_amt_glob"
                type="number"
                step="0.01"
                required
                max={selectedAdvanceToRepay?.remaining_amount}
                value={repayAdvanceForm.amount}
                onChange={(e) => setRepayAdvanceForm({ ...repayAdvanceForm, amount: e.target.value })}
              />
            </div>

            <HierarchicalTreasurySelect
              value={repayAdvanceForm.treasury_id}
              onValueChange={(val) => setRepayAdvanceForm({ ...repayAdvanceForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المودع فيها *"
              childLabel="الحساب / الفرع المودع فيه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="rep_dt_glob">تاريخ السداد</Label>
              <Input
                id="rep_dt_glob"
                type="date"
                value={repayAdvanceForm.date}
                onChange={(e) => setRepayAdvanceForm({ ...repayAdvanceForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rep_nt_glob">ملاحظات السداد</Label>
              <Textarea
                id="rep_nt_glob"
                placeholder="تفاصيل إضافية..."
                value={repayAdvanceForm.notes}
                onChange={(e) => setRepayAdvanceForm({ ...repayAdvanceForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={repayAdvanceMutation.isPending}
            >
              {repayAdvanceMutation.isPending ? "جاري الإيداع..." : "تأكيد السداد والإيداع في الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG 6: ISSUE CUSTODY ================= */}
      <Dialog open={isCustodyDialogOpen} onOpenChange={setIsCustodyDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>صرف عهدة مالية للموظف</DialogTitle>
            <DialogDescription>
              يتم خصم مبلغ العهدة من الخزينة وفتح حساب عهدة مالية تحت مسؤولية الموظف.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              issueCustodyMutation.mutate(custodyForm);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>الموظف المسؤول *</Label>
              <Select
                value={custodyForm.employee_id}
                onValueChange={(val) => setCustodyForm({ ...custodyForm, employee_id: val })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر الموظف..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                      {emp.name} {emp.position ? `(${emp.position})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>المشروع المرتبط (اختياري)</Label>
              <Select
                value={custodyForm.project_id}
                onValueChange={(val) => setCustodyForm({ ...custodyForm, project_id: val })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر المشروع (أو عهدة عامة)..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust_amt_all">مبلغ العهدة (د.ل) *</Label>
              <Input
                id="cust_amt_all"
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={custodyForm.amount}
                onChange={(e) => setCustodyForm({ ...custodyForm, amount: e.target.value })}
              />
            </div>

            <HierarchicalTreasurySelect
              value={custodyForm.treasury_id}
              onValueChange={(val) => setCustodyForm({ ...custodyForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المصروف منها *"
              childLabel="الحساب / الفرع المنصرف منه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="cust_dt_all">تاريخ الصرف</Label>
              <Input
                id="cust_dt_all"
                type="date"
                value={custodyForm.date}
                onChange={(e) => setCustodyForm({ ...custodyForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust_nt_all">ملاحظات / الغرض من العهدة</Label>
              <Textarea
                id="cust_nt_all"
                placeholder="بيان الغرض من صرف العهدة..."
                value={custodyForm.notes}
                onChange={(e) => setCustodyForm({ ...custodyForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={issueCustodyMutation.isPending}
            >
              {issueCustodyMutation.isPending ? "جاري الصرف..." : "تأكيد صرف العهدة وخصم الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG 7: RETURN CUSTODY ================= */}
      <Dialog open={isReturnCustodyDialogOpen} onOpenChange={setIsReturnCustodyDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>رد فائض العهدة نقدياً</DialogTitle>
            <DialogDescription>
              يتم استرجاع المبلغ المتبقي من العهدة وإيداعه فوراً في الخزينة المختارة وإغلاق العهدة.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              returnCustodyMutation.mutate(returnCustodyForm);
            }}
            className="space-y-4"
          >
            {selectedCustodyToReturn && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <div>الموظف: <span className="font-bold">{selectedCustodyToReturn.employee?.name}</span></div>
                <div>إجمالي العهدة: <span className="font-mono">{formatCurrencyLYD(selectedCustodyToReturn.amount)}</span></div>
                <div>المتبقي المطلوب رده: <span className="font-mono font-bold text-amber-600">{formatCurrencyLYD(selectedCustodyToReturn.remaining_amount)}</span></div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ret_amt_all">المبلغ المسترد (د.ل) *</Label>
              <Input
                id="ret_amt_all"
                type="number"
                step="0.01"
                required
                max={selectedCustodyToReturn?.remaining_amount}
                value={returnCustodyForm.amount}
                onChange={(e) => setReturnCustodyForm({ ...returnCustodyForm, amount: e.target.value })}
              />
            </div>

            <HierarchicalTreasurySelect
              value={returnCustodyForm.treasury_id}
              onValueChange={(val) => setReturnCustodyForm({ ...returnCustodyForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المودع فيها *"
              childLabel="الحساب / الفرع المودع فيه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="ret_dt_all">تاريخ الرد</Label>
              <Input
                id="ret_dt_all"
                type="date"
                value={returnCustodyForm.date}
                onChange={(e) => setReturnCustodyForm({ ...returnCustodyForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ret_nt_all">ملاحظات</Label>
              <Textarea
                id="ret_nt_all"
                placeholder="ملاحظات التسوية..."
                value={returnCustodyForm.notes}
                onChange={(e) => setReturnCustodyForm({ ...returnCustodyForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={returnCustodyMutation.isPending}
            >
              {returnCustodyMutation.isPending ? "جاري الإيداع والتسوية..." : "تأكيد رد العهدة والإيداع في الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
