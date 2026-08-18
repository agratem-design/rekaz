-- Migration: 20260818010000_technician_progress_finishing_support.sql
-- Description: FC-03 Canonical Finishing Labor Progress, Project/Phase Inheritance, Integrity Triggers, and Daily Worker Support

-- 1. Add direct project_id, phase_id, idempotency_key to technician_progress_records
ALTER TABLE public.technician_progress_records
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Backfill existing rows with project_id and phase_id from project_items
UPDATE public.technician_progress_records pr
SET 
  project_id = pi.project_id,
  phase_id = COALESCE(pr.phase_id, pi.phase_id)
FROM public.project_items pi
WHERE pr.project_item_id = pi.id AND pr.project_id IS NULL;

-- 3. Make project_id NOT NULL now that all historical rows are cleanly backfilled
ALTER TABLE public.technician_progress_records
  ALTER COLUMN project_id SET NOT NULL;

-- 4. Make project_item_id NULLABLE to support Finishing & Daily Labor without BOQ
ALTER TABLE public.technician_progress_records
  ALTER COLUMN project_item_id DROP NOT NULL;

-- 5. Indexes for fast query and idempotency protection
CREATE UNIQUE INDEX IF NOT EXISTS idx_tech_progress_idempotency 
  ON public.technician_progress_records (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_technician_progress_project 
  ON public.technician_progress_records (project_id);

CREATE INDEX IF NOT EXISTS idx_technician_progress_phase 
  ON public.technician_progress_records (phase_id);

CREATE INDEX IF NOT EXISTS idx_technician_progress_date 
  ON public.technician_progress_records (date);

-- 6. Canonical Integrity Trigger Function
CREATE OR REPLACE FUNCTION public.validate_technician_progress_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_project_type TEXT;
  v_item_project_id UUID;
  v_item_phase_id UUID;
  v_phase_project_id UUID;
BEGIN
  -- 1. Get project type
  SELECT project_type INTO v_project_type
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_project_type IS NULL THEN
    RAISE EXCEPTION 'INVALID_PROJECT: Project with id % does not exist', NEW.project_id;
  END IF;

  -- 2. Contracting Project Rules
  IF v_project_type = 'contracting' THEN
    IF NEW.project_item_id IS NULL THEN
      RAISE EXCEPTION 'CONTRACTING_REQUIRES_BOQ_ITEM: Contracting labor progress requires a valid BOQ item';
    END IF;

    -- Validate BOQ Item ownership
    SELECT project_id, phase_id INTO v_item_project_id, v_item_phase_id
    FROM public.project_items
    WHERE id = NEW.project_item_id;

    IF v_item_project_id IS NULL THEN
      RAISE EXCEPTION 'ITEM_NOT_FOUND: BOQ item with id % does not exist', NEW.project_item_id;
    END IF;

    IF v_item_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'CROSS_PROJECT_ITEM_MISMATCH: BOQ item % belongs to project %, not project %',
        NEW.project_item_id, v_item_project_id, NEW.project_id;
    END IF;

    -- Phase consistency
    IF v_item_phase_id IS NOT NULL THEN
      IF NEW.phase_id IS NULL THEN
        NEW.phase_id := v_item_phase_id;
      ELSIF NEW.phase_id <> v_item_phase_id THEN
        RAISE EXCEPTION 'ITEM_PHASE_MISMATCH: Selected phase % does not match BOQ item phase %',
          NEW.phase_id, v_item_phase_id;
      END IF;
    ELSIF NEW.phase_id IS NOT NULL THEN
      -- If item has no phase, but phase is supplied on record, verify phase belongs to project
      SELECT project_id INTO v_phase_project_id
      FROM public.project_phases
      WHERE id = NEW.phase_id;

      IF v_phase_project_id IS NULL OR v_phase_project_id <> NEW.project_id THEN
        RAISE EXCEPTION 'FOREIGN_PHASE_REJECTED: Phase % does not belong to project %',
          NEW.phase_id, NEW.project_id;
      END IF;
    END IF;

  -- 3. Finishing Project Rules
  ELSIF v_project_type = 'finishing' THEN
    IF NEW.project_item_id IS NOT NULL THEN
      RAISE EXCEPTION 'FINISHING_FORBIDS_BOQ_ITEM: Finishing labor progress must not reference a Contracting BOQ item';
    END IF;

    -- Phase validation if supplied
    IF NEW.phase_id IS NOT NULL THEN
      SELECT project_id INTO v_phase_project_id
      FROM public.project_phases
      WHERE id = NEW.phase_id;

      IF v_phase_project_id IS NULL OR v_phase_project_id <> NEW.project_id THEN
        RAISE EXCEPTION 'FOREIGN_PHASE_REJECTED: Phase % does not belong to project %',
          NEW.phase_id, NEW.project_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Attach Trigger
DROP TRIGGER IF EXISTS trg_validate_technician_progress_integrity ON public.technician_progress_records;
CREATE TRIGGER trg_validate_technician_progress_integrity
  BEFORE INSERT OR UPDATE ON public.technician_progress_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_technician_progress_integrity();

-- 8. Seed canonical daily worker type if not present
INSERT INTO public.technician_types (id, code, name, description, is_active)
VALUES ('d415717b-8919-4cb5-b461-7589d81d2a10', 'daily_worker', 'عامل / عمالة يومية', 'عمالة يومية ومياومة للموقع والأعمال المتنوعة', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;
