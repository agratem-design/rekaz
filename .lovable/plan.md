

## Plan: Progress Tracking Toggle & Technician Payment System

### Overview

Three main features to implement:

1. **Progress tracking toggle** in project settings (default: disabled)
2. **Treasury-based technician payments** with FIFO auto-deduction
3. **Advance payment** capability for technicians

---

### 1. Database Changes

**Migration: Add `progress_tracking_enabled` to `projects` table**
- Add `progress_tracking_enabled BOOLEAN DEFAULT false` column
- Default is `false` (disabled)

---

### 2. Project Settings (ManageProject.tsx)

- Add a new Switch toggle in the "إعدادات الفواتير" section:
  - Label: "تفعيل تسجيل الإنجاز"
  - Description: "عند التفعيل يمكن تسجيل إنجازات الفنيين يدوياً. عند الإيقاف يتم تسجيل الإنجاز كاملاً تلقائياً"
- Save the value with `progress_tracking_enabled` in create/update mutations

---

### 3. ProjectNavBar.tsx

- Conditionally show "الإنجاز" tab next to "المدفوعات" only when `progress_tracking_enabled` is true
- Query the project to check `progress_tracking_enabled` flag
- The progress tab already exists at `/projects/${id}/progress`

---

### 4. Auto-Complete Progress When Disabled

When progress tracking is disabled and a technician is assigned to a project item (`project_item_technicians`), the system should auto-register the full quantity as completed. This happens in the item creation/technician assignment flow:

- In `ProjectItems.tsx` or wherever technicians are assigned to items: when saving a technician assignment, if `progress_tracking_enabled` is false, automatically insert a `technician_progress_records` entry with `quantity_completed` = full item quantity
- This ensures technician dues are calculated immediately

---

### 5. Technician Payment from Treasury (TechnicianDetail.tsx)

Current withdrawal system saves to `expenses` table without treasury deduction. Changes needed:

- **Add treasury selection** to the withdrawal dialog (same parent/child treasury picker pattern used in `TechnicianServiceDialog`)
- **Add `treasury_id`** field to the expense insert
- **Deduct from treasury balance** when payment is made (insert `treasury_transactions` record or update treasury balance)
- **FIFO auto-payment**: When paying, automatically apply payment to the oldest unpaid dues first. Show which dues are being settled in the summary.

---

### 6. Advance Payment (TechnicianDetail.tsx)

- Add "دفعة على الحساب" button alongside the existing "سحب" button
- When a technician receives an advance payment:
  - Record it as an expense with a special flag/type (e.g., `description` prefixed with `[سلفة]`)
  - Deduct from selected treasury
  - When new work/progress comes in, the advance is automatically offset against new dues (already handled by the existing `remainingAmount = totalDeserved - totalWithdrawn` calculation)

---

### Technical Details

**Files to modify:**
- `supabase/migrations/` — new migration for `progress_tracking_enabled` column
- `src/pages/ManageProject.tsx` — add toggle for progress tracking
- `src/components/layout/ProjectNavBar.tsx` — conditionally show progress tab
- `src/pages/TechnicianDetail.tsx` — treasury picker in withdrawal dialog, advance payment button
- `src/pages/ProjectItems.tsx` (or equivalent) — auto-register progress when disabled
- `src/integrations/supabase/types.ts` — will auto-update after migration

**Existing patterns reused:**
- Treasury parent/child picker from `TechnicianServiceDialog`
- Switch toggle from `ManageProject.tsx` (has_purchase_sections pattern)
- Expense insertion for technician payments

