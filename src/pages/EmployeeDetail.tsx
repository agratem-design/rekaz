import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeterministicBreadcrumb } from "@/components/navigation/DeterministicBreadcrumb";
import { AccountSection, PartyAccountHeader, AccountSummaryGrid } from "@/components/accounts/PartyAccountShell";
import { financialRpc, invalidateFinancialQueries } from "@/lib/financialMutations";
import { HierarchicalTreasurySelect } from "@/components/treasury/HierarchicalTreasurySelect";
import { openSalarySlipPrintWindow } from "@/lib/salarySlipPrint";
import { openPrintWindow } from "@/lib/printStyles";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Users,
  Pencil,
  Copy,
  Check,
  Sparkles,
  Search,
  Filter,
  Banknote,
  Wallet,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  Briefcase,
  Building2,
  Printer,
  Plus,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

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
  treasury?: { id: string; name: string } | null;
}

interface AdvanceRepaymentRecord {
  id: string;
  advance_id: string;
  employee_id: string;
  amount: number;
  repayment_type: string;
  payroll_slip_id: string | null;
  treasury_id: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  treasury?: { id: string; name: string } | null;
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
  payroll?: {
    id: string;
    title: string;
    month: number;
    year: number;
  } | null;
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

const departmentLabels: Record<string, string> = {
  administration: "الإدارة",
  accounting: "المحاسبة",
  hr: "الموارد البشرية",
  operations: "العمليات",
  logistics: "اللوجستيات",
  other: "أخرى",
};

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit Employee Profile state
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(false);

  const openEditEmployeeModal = () => {
    if (!employee) return;
    setEditName(employee.name || "");
    setEditPhone(employee.phone || "");
    setEditEmail(employee.email || "");
    setEditPosition(employee.position || "");
    setEditDepartment(employee.department || "general");
    setEditSalary(employee.salary ? employee.salary.toString() : "");
    setEditNotes(employee.notes || "");
    setIsEditEmployeeOpen(true);
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success("تم نسخ رقم الهاتف");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (!employee) throw new Error("بيانات الموظف غير متوفرة");
      const { error } = await supabase
        .from("employees")
        .update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          position: editPosition.trim() || null,
          department: editDepartment || null,
          salary: editSalary ? parseFloat(editSalary) : null,
          notes: editNotes.trim() || null,
        })
        .eq("id", employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("تم تحديث بيانات الموظف بنجاح");
      setIsEditEmployeeOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ البيانات");
    },
  });

  // Dialog states
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceRecord | null>(null);
  const [isPaySlipDialogOpen, setIsPaySlipDialogOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollSlipRecord | null>(null);
  const [isCustodyDialogOpen, setIsCustodyDialogOpen] = useState(false);
  const [isReturnCustodyDialogOpen, setIsReturnCustodyDialogOpen] = useState(false);
  const [selectedCustody, setSelectedCustody] = useState<CustodyRecord | null>(null);

  // Form states
  const [advanceForm, setAdvanceForm] = useState({
    amount: "",
    monthly_deduction: "",
    treasury_id: "",
    disbursement_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [repayForm, setRepayForm] = useState({
    amount: "",
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [paySlipForm, setPaySlipForm] = useState({
    treasury_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [custodyForm, setCustodyForm] = useState({
    amount: "",
    project_id: "",
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
  const { data: employee, isLoading: isEmployeeLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Employee | null;
    },
    enabled: !!id,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ["employee-advances", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_advances")
        .select("*, treasury:treasuries(id, name)")
        .eq("employee_id", id!)
        .order("disbursement_date", { ascending: false });
      if (error) throw error;
      return data as AdvanceRecord[];
    },
    enabled: !!id,
  });

  const { data: repayments = [] } = useQuery({
    queryKey: ["employee-repayments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_advance_repayments")
        .select("*, treasury:treasuries(id, name)")
        .eq("employee_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as AdvanceRepaymentRecord[];
    },
    enabled: !!id,
  });

  const { data: slips = [] } = useQuery({
    queryKey: ["employee-slips", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_payroll_slips")
        .select(`
          *,
          payroll:employee_payrolls(id, title, month, year),
          treasury:treasuries(id, name)
        `)
        .eq("employee_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PayrollSlipRecord[];
    },
    enabled: !!id,
  });

  const { data: custodies = [] } = useQuery({
    queryKey: ["employee-custodies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_custody")
        .select(`
          *,
          project:projects(id, name),
          treasury:treasuries(id, name)
        `)
        .eq("holder_type", "employee")
        .eq("employee_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as CustodyRecord[];
    },
    enabled: !!id,
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

  // KPI calculations
  const basicSalary = employee?.salary || 0;
  const totalRemainingAdvances = advances
    .filter((a) => a.status === "active")
    .reduce((sum, a) => sum + (Number(a.remaining_amount) || 0), 0);
  const totalActiveCustody = custodies
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (Number(c.remaining_amount) || 0), 0);
  const totalAdvancesAmount = advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalAdvancesPaid = advances.reduce((sum, a) => sum + (Number(a.paid_back_amount) || 0), 0);
  const totalPaidSalaries = slips
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + Number(s.net_salary || 0), 0);
  const paidSlipsCount = slips.filter((s) => s.status === "paid").length;

  // Mutations
  const disburseAdvanceMutation = useMutation({
    mutationFn: async (vars: typeof advanceForm) => {
      const amount = parseFloat(vars.amount);
      const monthlyDeduction = vars.monthly_deduction ? parseFloat(vars.monthly_deduction) : null;
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ صحيح للسلفة");
      if (!vars.treasury_id) throw new Error("يرجى اختيار الخزينة المنصرف منها");

      return await financialRpc("disburse_employee_advance", {
        p_employee_id: id!,
        p_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_monthly_deduction: monthlyDeduction,
        p_notes: vars.notes || null,
        p_date: vars.disbursement_date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["employee-advances", id] });
      toast.success("تم صرف السلفة وخصم المبلغ من الخزينة بنجاح");
      setIsAdvanceDialogOpen(false);
      setAdvanceForm({
        amount: "",
        monthly_deduction: "",
        treasury_id: "",
        disbursement_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في صرف السلفة"),
  });

  const repayAdvanceMutation = useMutation({
    mutationFn: async (vars: typeof repayForm) => {
      if (!selectedAdvance) throw new Error("لم يتم تحديد السلفة");
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ سداد صحيح");
      if (amount > selectedAdvance.remaining_amount) {
        throw new Error(`مبلغ السداد يتجاوز الرصيد المتبقي للسلفة (${formatCurrencyLYD(selectedAdvance.remaining_amount)})`);
      }
      if (!vars.treasury_id) throw new Error("يرجى اختيار الخزينة المودع فيها");

      return await financialRpc("repay_employee_advance", {
        p_advance_id: selectedAdvance.id,
        p_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["employee-advances", id] });
      queryClient.invalidateQueries({ queryKey: ["employee-repayments", id] });
      toast.success("تم سداد السلفة وإيداع المبلغ في الخزينة بنجاح");
      setIsRepayDialogOpen(false);
      setSelectedAdvance(null);
      setRepayForm({
        amount: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في سداد السلفة"),
  });

  const disburseSlipMutation = useMutation({
    mutationFn: async (vars: typeof paySlipForm) => {
      if (!selectedSlip) throw new Error("لم يتم تحديد القسيمة");
      if (!vars.treasury_id) throw new Error("يرجى اختيار خزينة الصرف");

      return await financialRpc("disburse_payroll_slip", {
        p_slip_id: selectedSlip.id,
        p_treasury_id: vars.treasury_id,
        p_date: vars.date || new Date().toISOString().split("T")[0],
        p_notes: vars.notes || null,
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["employee-slips", id] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances", id] });
      queryClient.invalidateQueries({ queryKey: ["employee-repayments", id] });
      toast.success("تم صرف قسيمة الراتب بنجاح وتحديث أرصدة الخزينة والسلف");
      setIsPaySlipDialogOpen(false);
      setSelectedSlip(null);
    },
    onError: (err: any) => toast.error(err.message || "فشل في صرف قسيمة الراتب"),
  });

  const issueCustodyMutation = useMutation({
    mutationFn: async (vars: typeof custodyForm) => {
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ صحيح للعهدة");
      if (!vars.treasury_id) throw new Error("يرجى تحديد الخزينة المنصرف منها");

      return await financialRpc("issue_employee_custody", {
        p_holder_type: "employee",
        p_holder_id: id!,
        p_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_project_id: vars.project_id || null,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["employee-custodies", id] });
      toast.success("تم صرف العهدة وخصمها من الخزينة بنجاح");
      setIsCustodyDialogOpen(false);
      setCustodyForm({
        amount: "",
        project_id: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في صرف العهدة"),
  });

  const returnCustodyMutation = useMutation({
    mutationFn: async (vars: typeof returnCustodyForm) => {
      if (!selectedCustody) throw new Error("لم يتم تحديد العهدة");
      const amount = parseFloat(vars.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ رد صحيح");
      if (amount > selectedCustody.remaining_amount) {
        throw new Error(`مبلغ الرد يتجاوز المتبقي من العهدة (${formatCurrencyLYD(selectedCustody.remaining_amount)})`);
      }
      if (!vars.treasury_id) throw new Error("يرجى تحديد الخزينة المودع فيها");

      return await financialRpc("settle_custody_cash_return", {
        p_custody_id: selectedCustody.id,
        p_return_amount: amount,
        p_treasury_id: vars.treasury_id,
        p_notes: vars.notes || null,
        p_date: vars.date || new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["employee-custodies", id] });
      toast.success("تم رد العهدة النقدية وإيداعها في الخزينة بنجاح");
      setIsReturnCustodyDialogOpen(false);
      setSelectedCustody(null);
      setReturnCustodyForm({
        amount: "",
        treasury_id: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message || "فشل في رد العهدة"),
  });

  const handlePrintSalarySlip = (slip: PayrollSlipRecord) => {
    if (!employee) return;
    openSalarySlipPrintWindow(
      {
        slipNumber: slip.id.substring(0, 8).toUpperCase(),
        month: slip.payroll?.month || 1,
        year: slip.payroll?.year || new Date().getFullYear(),
        payrollTitle: slip.payroll?.title || "مسير رواتب",
        employeeName: employee.name,
        department: departmentLabels[employee.department || ""] || employee.department,
        position: employee.position,
        phone: employee.phone,
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

  const handlePrintStatement = () => {
    if (!employee) return;
    const title = `كشف حساب موظف - ${employee.name}`;
    const content = `
      <div class="print-area" style="max-width: 850px; margin: 0 auto; padding: 20px; font-family: 'Tajawal', sans-serif;">
        <div style="text-align: center; border-bottom: 2px solid #b4a078; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 class="print-report-title" style="margin: 0; font-size: 20px; font-weight: 800;">كشف حساب موظف شامل</h2>
          <div class="print-report-subtitle" style="font-size: 14px; color: #b4a078; font-weight: 600; margin-top: 4px;">
            الموظف: ${employee.name} | القسم: ${departmentLabels[employee.department || ""] || employee.department || "-"}
          </div>
          <div style="font-size: 11px; color: #777; margin-top: 4px;">
            تاريخ التقرير: ${format(new Date(), "dd MMMM yyyy", { locale: ar })}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 12px; color: #64748b;">الراتب الشهري الأساسي</div>
            <div style="font-size: 18px; font-weight: 800; color: #0284c7; direction: ltr;">${formatCurrencyLYD(basicSalary)}</div>
          </div>
          <div style="background: #fdf8f8; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 12px; color: #dc2626;">رصيد السلف المتبقية</div>
            <div style="font-size: 18px; font-weight: 800; color: #dc2626; direction: ltr;">${formatCurrencyLYD(totalRemainingAdvances)}</div>
          </div>
          <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 12px; color: #ca8a04;">إجمالي العهد المفتوحة</div>
            <div style="font-size: 18px; font-weight: 800; color: #ca8a04; direction: ltr;">${formatCurrencyLYD(totalActiveCustody)}</div>
          </div>
        </div>

        <h3 style="font-size: 15px; font-weight: 700; border-right: 4px solid #b4a078; padding-right: 8px; margin-bottom: 10px;">
          سجل السلف المالية
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: right;">التاريخ</th>
              <th style="padding: 8px; text-align: right;">المبلغ</th>
              <th style="padding: 8px; text-align: right;">المسدد</th>
              <th style="padding: 8px; text-align: right;">المتبقي</th>
              <th style="padding: 8px; text-align: right;">الخزينة</th>
              <th style="padding: 8px; text-align: right;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${advances.map((a) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px;">${a.disbursement_date}</td>
                <td style="padding: 8px; direction: ltr; text-align: right;">${formatCurrencyLYD(a.amount)}</td>
                <td style="padding: 8px; direction: ltr; text-align: right; color: #16a34a;">${formatCurrencyLYD(a.paid_back_amount)}</td>
                <td style="padding: 8px; direction: ltr; text-align: right; font-weight: 700; color: ${a.remaining_amount > 0 ? '#dc2626' : '#16a34a'};">${formatCurrencyLYD(a.remaining_amount)}</td>
                <td style="padding: 8px;">${a.treasury?.name || '-'}</td>
                <td style="padding: 8px;">${a.status === 'active' ? 'نشطة' : 'مسددة بالكامل'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h3 style="font-size: 15px; font-weight: 700; border-right: 4px solid #b4a078; padding-right: 8px; margin-bottom: 10px;">
          سجل الرواتب الشهرية
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: right;">المسير</th>
              <th style="padding: 8px; text-align: right;">الأساسي</th>
              <th style="padding: 8px; text-align: right;">البدلات</th>
              <th style="padding: 8px; text-align: right;">الخصومات</th>
              <th style="padding: 8px; text-align: right;">قسط السلفة</th>
              <th style="padding: 8px; text-align: right;">الصافي</th>
              <th style="padding: 8px; text-align: right;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${slips.map((s) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px;">${s.payroll?.title || '-'}</td>
                <td style="padding: 8px; direction: ltr; text-align: right;">${formatCurrencyLYD(s.basic_salary)}</td>
                <td style="padding: 8px; direction: ltr; text-align: right; color: #16a34a;">+${formatCurrencyLYD(s.allowances)}</td>
                <td style="padding: 8px; direction: ltr; text-align: right; color: #dc2626;">-${formatCurrencyLYD(s.deductions)}</td>
                <td style="padding: 8px; direction: ltr; text-align: right; color: #ea580c;">-${formatCurrencyLYD(s.advance_deduction)}</td>
                <td style="padding: 8px; direction: ltr; text-align: right; font-weight: 700;">${formatCurrencyLYD(s.net_salary)}</td>
                <td style="padding: 8px;">${s.status === 'paid' ? 'مصروف' : 'مسودة'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    openPrintWindow(title, content, companySettings);
  };

  if (isEmployeeLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto p-6 space-y-4 text-center" dir="rtl">
        <h2 className="text-xl font-bold">الموظف غير موجود</h2>
        <Button onClick={() => navigate("/employees")}>العودة لقائمة الموظفين</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl" dir="rtl">
      {/* Breadcrumb */}
      <DeterministicBreadcrumb
        items={[
          { label: "الموظفين والرواتب", href: "/employees" },
          { label: employee.name },
        ]}
      />

      {/* Golden Hero Header */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-l from-primary/5 via-background to-card p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {employee.name}
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 gap-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>نشط</span>
                </Badge>
                <Badge variant="secondary" className="text-[11px] font-bold bg-muted/60">
                  <span>ملف موظف</span>
                </Badge>
                {employee.position && (
                  <Badge variant="outline" className="text-[11px] font-medium border-border/70 gap-1">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    <span>{employee.position}</span>
                  </Badge>
                )}
                {employee.department && (
                  <Badge variant="outline" className="text-[11px] font-medium border-border/70 gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span>{departmentLabels[employee.department] || employee.department}</span>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                  onClick={openEditEmployeeModal}
                  title="تعديل بيانات الموظف"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Contact details & Hire date */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {employee.phone ? (
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-lg border border-border/50">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${employee.phone}`}
                      className="font-mono text-foreground hover:text-primary transition-colors text-xs"
                      dir="ltr"
                    >
                      {employee.phone}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => copyPhone(employee.phone!)}
                      title="نسخ رقم الهاتف"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">لا يوجد هاتف مسجل</span>
                )}

                {employee.email && (
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-lg border border-border/50">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={`mailto:${employee.email}`} className="text-foreground hover:text-primary transition-colors text-xs" dir="ltr">
                      {employee.email}
                    </a>
                  </div>
                )}

                {employee.hire_date && (
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-lg border border-border/50">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>تاريخ التعيين: <span className="font-mono">{format(new Date(employee.hire_date), "dd MMMM yyyy", { locale: ar })}</span></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Balance indicator */}
          <div className="flex items-center gap-4 bg-muted/40 rounded-xl p-3 border border-border/60">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-bold block">
                {totalRemainingAdvances > 0 ? "رصيد السلف القائمة" : "لا توجد سلف متبقية"}
              </span>
              <span className="text-base font-black font-mono tracking-tight text-destructive" dir="ltr">
                {formatCurrencyLYD(totalRemainingAdvances)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setIsAdvanceDialogOpen(true)}
              className="h-9 cursor-pointer gap-2 font-bold shadow-2xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              <span>صرف سلفة مالية</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsCustodyDialogOpen(true)}
              className="h-9 cursor-pointer gap-2 border-amber-600/30 text-amber-700 dark:text-amber-400 hover:bg-amber-600/10 font-bold bg-card"
            >
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>صرف عهدة</span>
            </Button>

            <Button
              variant="outline"
              onClick={handlePrintStatement}
              className="h-9 cursor-pointer gap-2 border-border/80 font-bold bg-card hover:bg-muted"
            >
              <Printer className="h-4 w-4 text-blue-600" />
              <span>كشف حساب شامل</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>قسائم الرواتب:</span>
            <Badge variant="outline" className="font-mono font-bold text-xs">
              {slips.length}
            </Badge>
          </div>
        </div>
      </div>

      {/* 4-Card Golden KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Basic Salary */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الراتب الأساسي الشهري</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-primary font-mono" dir="ltr">
              {formatCurrencyLYD(basicSalary)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>الراتب التعاقدي المعتمد</span>
            <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
              شهري
            </Badge>
          </div>
        </Card>

        {/* Card 2: Total Paid Salaries */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-emerald-500/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الرواتب المصروفة</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono" dir="ltr">
              {formatCurrencyLYD(totalPaidSalaries)}
            </span>
            <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
              {paidSlipsCount} قسيمة
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>صافي الرواتب المسددة</span>
            <span>الفعلي</span>
          </div>
        </Card>

        {/* Card 3: Remaining Advances */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-destructive/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">رصيد السلف القائمة</span>
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-destructive font-mono" dir="ltr">
              {formatCurrencyLYD(totalRemainingAdvances)}
            </span>
            <Badge variant="outline" className="text-[10px] font-bold border-destructive/30 text-destructive bg-destructive/5">
              {advances.filter((a) => a.remaining_amount > 0).length} سلف نشطة
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>إجمالي السلف: {formatCurrencyLYD(totalAdvancesAmount)}</span>
            <span>مسدد: {formatCurrencyLYD(totalAdvancesPaid)}</span>
          </div>
        </Card>

        {/* Card 4: Active Custody */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-amber-500/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">العهد المالية النشطة</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono" dir="ltr">
              {formatCurrencyLYD(totalActiveCustody)}
            </span>
            <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10">
              {custodies.filter((c) => c.status === "active").length} عهدة
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مبالغ قيد الصرف والتسوية</span>
            <span>مفتوحة</span>
          </div>
        </Card>
      </div>

      {/* Main Tabs Section */}
      <Tabs defaultValue="slips" className="w-full space-y-4" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-10 p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="slips" className="rounded-lg text-xs font-bold cursor-pointer">
            قسائم الرواتب ({slips.length})
          </TabsTrigger>
          <TabsTrigger value="advances" className="rounded-lg text-xs font-bold cursor-pointer">
            سجل السلف ({advances.length})
          </TabsTrigger>
          <TabsTrigger value="custody" className="rounded-lg text-xs font-bold cursor-pointer">
            العهد المالية ({custodies.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. Salary Slips Tab */}
        <TabsContent value="slips" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-xs font-bold text-foreground">قسائم ومفردات الرواتب الشهرية</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                سجل الرواتب الشهرية والبدلات والاستقطاعات التلقائية مع إمكانية طباعة القسائم وصرفها
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-2xs">
            {slips.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Banknote className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs">لا توجد قسائم رواتب مسجلة لهذا الموظف حتى الآن.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-right text-xs font-bold">مسير الرواتب</TableHead>
                    <TableHead className="text-center text-xs font-bold">الراتب الأساسي</TableHead>
                    <TableHead className="text-center text-xs font-bold">البدلات</TableHead>
                    <TableHead className="text-center text-xs font-bold">الخصومات</TableHead>
                    <TableHead className="text-center text-xs font-bold">قسط السلفة</TableHead>
                    <TableHead className="text-center text-xs font-bold">صافي الراتب</TableHead>
                    <TableHead className="text-right text-xs font-bold">خزينة الصرف</TableHead>
                    <TableHead className="text-center text-xs font-bold">الحالة</TableHead>
                    <TableHead className="text-left text-xs font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map((slip) => (
                    <TableRow key={slip.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-bold text-xs">
                        <div className="flex flex-col">
                          <span>{slip.payroll?.title || "مسير رواتب"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {slip.payroll ? `${slip.payroll.month} / ${slip.payroll.year}` : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs">
                        {formatCurrencyLYD(slip.basic_salary)}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs text-emerald-600">
                        {slip.allowances > 0 ? `+${formatCurrencyLYD(slip.allowances)}` : "-"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs text-destructive">
                        {slip.deductions > 0 ? `-${formatCurrencyLYD(slip.deductions)}` : "-"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs text-amber-600">
                        {slip.advance_deduction > 0 ? `-${formatCurrencyLYD(slip.advance_deduction)}` : "-"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono font-black text-xs text-primary">
                        {formatCurrencyLYD(slip.net_salary)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slip.treasury?.name || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={slip.status === "paid" ? "secondary" : "outline"}
                          className={`text-[10px] font-bold ${
                            slip.status === "paid"
                              ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                              : "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                          }`}
                        >
                          {slip.status === "paid" ? "تم الصرف" : "معلق"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1.5">
                          {slip.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSlip(slip);
                                setIsPaySlipDialogOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold gap-1 border-primary/30 text-primary cursor-pointer"
                            >
                              <Banknote className="h-3 w-3" />
                              <span>صرف</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintSalarySlip(slip)}
                            className="h-7 px-2 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>طباعة</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* 2. Advances Tab */}
        <TabsContent value="advances" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-xs font-bold text-foreground">سجل السلف المالية والاقتطاعات</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                تتبع مبالغ السلف المنصرفة والأقساط الشهرية المسددة والرصيد القائم
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAdvanceDialogOpen(true)}
              className="h-8 text-xs font-bold gap-1.5 cursor-pointer bg-primary text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>صرف سلفة جديدة</span>
            </Button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-2xs">
            {advances.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs">لا توجد سلف مالية مسجلة لهذا الموظف.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-right text-xs font-bold">تاريخ الصرف</TableHead>
                    <TableHead className="text-center text-xs font-bold">مبلغ السلفة</TableHead>
                    <TableHead className="text-center text-xs font-bold">القسط الشهري</TableHead>
                    <TableHead className="text-center text-xs font-bold">المسدد</TableHead>
                    <TableHead className="text-center text-xs font-bold">المتبقي</TableHead>
                    <TableHead className="text-right text-xs font-bold">خزينة الصرف</TableHead>
                    <TableHead className="text-center text-xs font-bold">الحالة</TableHead>
                    <TableHead className="text-left text-xs font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-xs">{a.disbursement_date}</TableCell>
                      <TableCell dir="ltr" className="text-center font-mono font-bold text-xs">
                        {formatCurrencyLYD(a.amount)}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs text-muted-foreground">
                        {a.monthly_deduction ? formatCurrencyLYD(a.monthly_deduction) : "كامل المبلغ"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs text-emerald-600">
                        {formatCurrencyLYD(a.paid_back_amount)}
                      </TableCell>
                      <TableCell
                        dir="ltr"
                        className={`text-center font-mono font-black text-xs ${a.remaining_amount > 0 ? "text-destructive" : "text-emerald-600"}`}
                      >
                        {formatCurrencyLYD(a.remaining_amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.treasury?.name || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={a.status === "active" ? "secondary" : "outline"}
                          className={`text-[10px] font-bold ${a.status === "active" ? "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10" : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"}`}
                        >
                          {a.status === "active" ? "قائمة" : "مسددة"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        {a.remaining_amount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAdvance(a);
                              setRepayForm((prev) => ({
                                ...prev,
                                amount: a.remaining_amount.toString(),
                              }));
                              setIsRepayDialogOpen(true);
                            }}
                            className="h-7 px-2 text-xs font-bold gap-1 border-primary/30 text-primary cursor-pointer"
                          >
                            <Banknote className="h-3 w-3" />
                            <span>سداد دفعة</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* 3. Custody Tab */}
        <TabsContent value="custody" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-xs font-bold text-foreground">العهد المالية التشغيلية</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                متابعة مبالغ العهد المصروفة للمشاريع والمصروفات المسجلة ورد المتبقي للخزينة
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCustodyDialogOpen(true)}
              className="h-8 text-xs font-bold gap-1.5 border-amber-600/30 text-amber-700 dark:text-amber-400 hover:bg-amber-600/10 cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              <span>صرف عهدة جديدة</span>
            </Button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-2xs">
            {custodies.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs">لا توجد عهد مالية مسجلة لهذا الموظف.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                    <TableHead className="text-right text-xs font-bold">المشروع</TableHead>
                    <TableHead className="text-center text-xs font-bold">مبلغ العهدة</TableHead>
                    <TableHead className="text-center text-xs font-bold">المصروف</TableHead>
                    <TableHead className="text-center text-xs font-bold">المتبقي</TableHead>
                    <TableHead className="text-right text-xs font-bold">خزينة الصرف</TableHead>
                    <TableHead className="text-center text-xs font-bold">الحالة</TableHead>
                    <TableHead className="text-left text-xs font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custodies.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-xs">{c.date}</TableCell>
                      <TableCell className="font-bold text-xs">
                        {c.project?.name || "عهدة عامة"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono font-bold text-xs">
                        {formatCurrencyLYD(c.amount)}
                      </TableCell>
                      <TableCell dir="ltr" className="text-center font-mono text-xs text-destructive">
                        {formatCurrencyLYD(c.spent_amount)}
                      </TableCell>
                      <TableCell
                        dir="ltr"
                        className={`text-center font-mono font-black text-xs ${c.remaining_amount > 0 ? "text-amber-600" : "text-muted-foreground"}`}
                      >
                        {formatCurrencyLYD(c.remaining_amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.treasury?.name || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={c.status === "active" ? "secondary" : "outline"}
                          className={`text-[10px] font-bold ${c.status === "active" ? "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10" : ""}`}
                        >
                          {c.status === "active" ? "نشطة" : "مسواة"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-1.5">
                          {c.remaining_amount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCustody(c);
                                setReturnCustodyForm((prev) => ({
                                  ...prev,
                                  amount: c.remaining_amount.toString(),
                                }));
                                setIsReturnCustodyDialogOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold gap-1 border-amber-600/30 text-amber-700 hover:bg-amber-600/10 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3 text-amber-600" />
                              <span>رد المتبقي</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/custody/${c.id}`)}
                            className="h-7 px-2 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>تفاصيل</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Edit Employee Profile Dialog */}
      <Dialog open={isEditEmployeeOpen} onOpenChange={setIsEditEmployeeOpen}>
        <DialogContent className="max-w-md bg-background p-6 rounded-2xl border border-border shadow-2xl" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-base">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Pencil className="h-4 w-4" />
              </div>
              <span>تعديل بيانات الموظف</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              قم بتحديث المعلومات الوظيفية والراتب الأساسي للموظف
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateEmployeeMutation.mutate();
            }}
            className="space-y-3.5 mt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم الموظف *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">رقم الهاتف</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  placeholder="09..."
                  className="h-9 text-xs rounded-xl font-mono text-right"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">القسم</Label>
                <Select value={editDepartment} onValueChange={setEditDepartment}>
                  <SelectTrigger className="h-9 text-xs rounded-xl" dir="rtl">
                    <SelectValue placeholder="اختر القسم..." />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="management">الإدارة</SelectItem>
                    <SelectItem value="engineering">الهندسة والإشراف</SelectItem>
                    <SelectItem value="finance">المالية والحسابات</SelectItem>
                    <SelectItem value="operations">العمليات والمواقع</SelectItem>
                    <SelectItem value="general">عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">المسمى الوظيفي</Label>
                <Input
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  placeholder="مهندس موقع، محاسب..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الراتب الأساسي (د.ل)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-xs rounded-xl font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">البريد الإلكتروني</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                dir="ltr"
                placeholder="employee@example.com"
                className="h-9 text-xs rounded-xl text-right"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">ملاحظات إضافية</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="أي شروط أو تفاصيل تعاقدية خاصة بالموظف..."
                className="text-xs rounded-xl min-h-[60px]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditEmployeeOpen(false)}
                className="h-9 text-xs rounded-xl cursor-pointer"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={updateEmployeeMutation.isPending || !editName.trim()}
                className="h-9 text-xs rounded-xl font-bold bg-primary text-primary-foreground cursor-pointer"
              >
                {updateEmployeeMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 1. Dialog: Disburse Advance */}
      <Dialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>صرف سلفة مالية للموظف</DialogTitle>
            <DialogDescription>
              يتم خصم مبلغ السلفة فوراً وبشكل آمن من الخزينة المحددة وتسجيلها في حساب الموظف.
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
              <Label>الموظف</Label>
              <Input value={employee.name} disabled className="bg-muted" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adv_amount">مبلغ السلفة (د.ل) *</Label>
                <Input
                  id="adv_amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adv_monthly">القسط الشهري للاقتطاع</Label>
                <Input
                  id="adv_monthly"
                  type="number"
                  step="0.01"
                  placeholder="اختياري (أو كامل المبلغ)"
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
              <Label htmlFor="adv_date">تاريخ الصرف</Label>
              <Input
                id="adv_date"
                type="date"
                value={advanceForm.disbursement_date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, disbursement_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adv_notes">ملاحظات / أسباب السلفة</Label>
              <Textarea
                id="adv_notes"
                placeholder="ملاحظات إضافية..."
                value={advanceForm.notes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={disburseAdvanceMutation.isPending}
            >
              {disburseAdvanceMutation.isPending ? "جاري الصرف والتسجيل..." : "تأكيد صرف السلفة وخصم الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Dialog: Repay Advance Cash */}
      <Dialog open={isRepayDialogOpen} onOpenChange={setIsRepayDialogOpen}>
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
              repayAdvanceMutation.mutate(repayForm);
            }}
            className="space-y-4"
          >
            {selectedAdvance && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <div>إجمالي السلفة: <span className="font-mono font-bold">{formatCurrencyLYD(selectedAdvance.amount)}</span></div>
                <div>الرصيد المتبقي: <span className="font-mono font-bold text-destructive">{formatCurrencyLYD(selectedAdvance.remaining_amount)}</span></div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rep_amount">المبلغ المسدد (د.ل) *</Label>
              <Input
                id="rep_amount"
                type="number"
                step="0.01"
                required
                max={selectedAdvance?.remaining_amount}
                placeholder="0.00"
                value={repayForm.amount}
                onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
              />
            </div>

            <HierarchicalTreasurySelect
              value={repayForm.treasury_id}
              onValueChange={(val) => setRepayForm({ ...repayForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المودع فيها *"
              childLabel="الحساب / الفرع المودع فيه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="rep_date">تاريخ السداد</Label>
              <Input
                id="rep_date"
                type="date"
                value={repayForm.date}
                onChange={(e) => setRepayForm({ ...repayForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rep_notes">ملاحظات السداد</Label>
              <Textarea
                id="rep_notes"
                placeholder="رقم الإيصال أو تفاصيل السداد..."
                value={repayForm.notes}
                onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={repayAdvanceMutation.isPending}
            >
              {repayAdvanceMutation.isPending ? "جاري تسجيل السداد..." : "تأكيد السداد والإيداع في الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Dialog: Pay Slip */}
      <Dialog open={isPaySlipDialogOpen} onOpenChange={setIsPaySlipDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>صرف قسيمة الراتب</DialogTitle>
            <DialogDescription>
              سيتم خصم صافي الراتب من الخزينة المحددة وتسجيل سداد قسط السلفة تلقائياً إن وجد.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              disburseSlipMutation.mutate(paySlipForm);
            }}
            className="space-y-4"
          >
            {selectedSlip && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5">
                <div className="font-bold">{selectedSlip.payroll?.title}</div>
                <div className="flex justify-between">
                  <span>الراتب الأساسي:</span>
                  <span className="font-mono">{formatCurrencyLYD(selectedSlip.basic_salary)}</span>
                </div>
                {selectedSlip.advance_deduction > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>قسط استقطاع السلفة:</span>
                    <span className="font-mono">-{formatCurrencyLYD(selectedSlip.advance_deduction)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1 text-primary">
                  <span>صافي الراتب المستحق للصرف:</span>
                  <span className="font-mono text-sm">{formatCurrencyLYD(selectedSlip.net_salary)}</span>
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
              <Label htmlFor="ps_date">تاريخ الصرف</Label>
              <Input
                id="ps_date"
                type="date"
                value={paySlipForm.date}
                onChange={(e) => setPaySlipForm({ ...paySlipForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ps_notes">ملاحظات الصرف</Label>
              <Textarea
                id="ps_notes"
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
              {disburseSlipMutation.isPending ? "جاري الصرف..." : "تأكيد صرف الراتب وخصم الخزينة"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Dialog: Issue Custody */}
      <Dialog open={isCustodyDialogOpen} onOpenChange={setIsCustodyDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>صرف عهدة مالية للموظف</DialogTitle>
            <DialogDescription>
              يتم خصم مبلغ العهدة من الخزينة المحددة وفتح حساب عهدة مالية تحت مسؤولية الموظف.
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
              <Label htmlFor="cust_amount">مبلغ العهدة (د.ل) *</Label>
              <Input
                id="cust_amount"
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={custodyForm.amount}
                onChange={(e) => setCustodyForm({ ...custodyForm, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>المشروع المرتبط (اختياري)</Label>
              <Select
                value={custodyForm.project_id}
                onValueChange={(val) => setCustodyForm({ ...custodyForm, project_id: val })}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر المشروع إن وُجد (أو عهدة عامة)..." />
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

            <HierarchicalTreasurySelect
              value={custodyForm.treasury_id}
              onValueChange={(val) => setCustodyForm({ ...custodyForm, treasury_id: val })}
              treasuries={treasuries}
              parentLabel="الخزينة الرئيسية المصروف منها *"
              childLabel="الحساب / الفرع المنصرف منه *"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="cust_date">تاريخ الصرف</Label>
              <Input
                id="cust_date"
                type="date"
                value={custodyForm.date}
                onChange={(e) => setCustodyForm({ ...custodyForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cust_notes">ملاحظات / الغرض من العهدة</Label>
              <Textarea
                id="cust_notes"
                placeholder="بيان الغرض من العهدة..."
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

      {/* 5. Dialog: Return Custody Cash */}
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
            {selectedCustody && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <div>إجمالي العهدة: <span className="font-mono font-bold">{formatCurrencyLYD(selectedCustody.amount)}</span></div>
                <div>المصروف منها: <span className="font-mono">{formatCurrencyLYD(selectedCustody.spent_amount)}</span></div>
                <div>المتبقي المطلوب رده: <span className="font-mono font-bold text-amber-600">{formatCurrencyLYD(selectedCustody.remaining_amount)}</span></div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ret_cust_amount">المبلغ المسترد (د.ل) *</Label>
              <Input
                id="ret_cust_amount"
                type="number"
                step="0.01"
                required
                max={selectedCustody?.remaining_amount}
                placeholder="0.00"
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
              <Label htmlFor="ret_cust_date">تاريخ الرد</Label>
              <Input
                id="ret_cust_date"
                type="date"
                value={returnCustodyForm.date}
                onChange={(e) => setReturnCustodyForm({ ...returnCustodyForm, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ret_cust_notes">ملاحظات الرد</Label>
              <Textarea
                id="ret_cust_notes"
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
