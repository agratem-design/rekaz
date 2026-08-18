-- ========================================================
-- MIGRATION: Contracting Technician Staffing Requirements Model
-- ========================================================

-- 1. Create canonical technician_types table
CREATE TABLE IF NOT EXISTS public.technician_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text UNIQUE NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed standard technician types
INSERT INTO public.technician_types (code, name, description)
VALUES 
    ('gypsum', 'فني جبس / جبس بورد', 'أعمال وتركيب قواطع وأسقف الجبس بورد'),
    ('assistant', 'مساعد فني', 'مساعد فني عام للمساندة والتحضير'),
    ('electrician', 'كهربائي', 'تمديدات وتركيبات كهربائية'),
    ('plumber', 'سباك', 'أعمال وتمديدات صحية وشبكات مياه'),
    ('carpenter', 'نجار', 'أعمال نجارة مسلحة وتشطيب'),
    ('blacksmith', 'حداد', 'أعمال حدادة وتسليح وهياكل معدنية'),
    ('painter', 'دهّان', 'أعمال طلاء ودهانات وتشطيبات نهائية'),
    ('tiler', 'بلّاط', 'أعمال تركيب سيراميك ورخام وبلاط'),
    ('aluminum', 'ألمنيوم', 'أعمال وتركيب قطاعات الألمنيوم والزجاج'),
    ('builder', 'بنّاء', 'أعمال بناء طوب وبلوك وحوائط'),
    ('other', 'أخرى', 'تخصصات ومهن فنية أخرى')
ON CONFLICT (code) DO NOTHING;

-- 2. Add technician_type_id to technicians table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'technicians' AND column_name = 'technician_type_id'
    ) THEN
        ALTER TABLE public.technicians 
        ADD COLUMN technician_type_id uuid REFERENCES public.technician_types(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Backfill existing technician 'جبس بورد' to gypsum type
UPDATE public.technicians t
SET technician_type_id = tt.id
FROM public.technician_types tt
WHERE t.specialty = 'جبس بورد' AND tt.code = 'gypsum' AND t.technician_type_id IS NULL;

-- Trigger to keep specialty in sync with technician_type_id
CREATE OR REPLACE FUNCTION public.sync_technician_specialty()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.technician_type_id IS NOT NULL THEN
        SELECT name INTO NEW.specialty
        FROM public.technician_types
        WHERE id = NEW.technician_type_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_technician_specialty ON public.technicians;
CREATE TRIGGER trg_sync_technician_specialty
BEFORE INSERT OR UPDATE ON public.technicians
FOR EACH ROW
EXECUTE FUNCTION public.sync_technician_specialty();

-- Trigger to propagate technician_types.name rename to technicians.specialty mirror
CREATE OR REPLACE FUNCTION public.propagate_technician_type_rename()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
        UPDATE public.technicians
        SET specialty = NEW.name
        WHERE technician_type_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_technician_types_propagate_rename ON public.technician_types;
CREATE TRIGGER trg_technician_types_propagate_rename
AFTER UPDATE OF name ON public.technician_types
FOR EACH ROW
EXECUTE FUNCTION public.propagate_technician_type_rename();

-- 3. Create general_item_technician_requirements table
CREATE TABLE IF NOT EXISTS public.general_item_technician_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    general_item_id uuid NOT NULL REFERENCES public.general_project_items(id) ON DELETE CASCADE,
    technician_type_id uuid NOT NULL REFERENCES public.technician_types(id) ON DELETE RESTRICT,
    required_count integer NOT NULL DEFAULT 1 CHECK (required_count > 0),
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_general_item_tech_req UNIQUE (general_item_id, technician_type_id)
);

-- 4. Add general_item_id to project_items table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_items' AND column_name = 'general_item_id'
    ) THEN
        ALTER TABLE public.project_items 
        ADD COLUMN general_item_id uuid REFERENCES public.general_project_items(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Create project_item_technician_requirements table
CREATE TABLE IF NOT EXISTS public.project_item_technician_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_item_id uuid NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
    technician_type_id uuid NOT NULL REFERENCES public.technician_types(id) ON DELETE RESTRICT,
    required_count integer NOT NULL DEFAULT 1 CHECK (required_count > 0),
    source_general_item_requirement_id uuid REFERENCES public.general_item_technician_requirements(id) ON DELETE SET NULL,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_item_tech_req UNIQUE (project_item_id, technician_type_id)
);

-- 6. Add UNIQUE constraint on project_item_technicians(project_item_id, technician_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_project_item_technicians_assignment'
    ) THEN
        ALTER TABLE public.project_item_technicians
        ADD CONSTRAINT uq_project_item_technicians_assignment UNIQUE (project_item_id, technician_id);
    END IF;
END $$;

-- 7. Snapshot RPC & Trigger
CREATE OR REPLACE FUNCTION public.snapshot_project_item_requirements_from_general_item(
    p_project_item_id uuid,
    p_general_item_id uuid
)
RETURNS integer AS $$
DECLARE
    v_count integer := 0;
BEGIN
    IF p_project_item_id IS NULL OR p_general_item_id IS NULL THEN
        RETURN 0;
    END IF;

    -- If called from client session (auth.uid() is not null), verify admin/supervisor role
    IF auth.uid() IS NOT NULL THEN
        IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: Insufficient permissions to snapshot staffing requirements';
        END IF;
    END IF;

    INSERT INTO public.project_item_technician_requirements (
        project_item_id,
        technician_type_id,
        required_count,
        source_general_item_requirement_id,
        notes
    )
    SELECT 
        p_project_item_id,
        technician_type_id,
        required_count,
        id,
        notes
    FROM public.general_item_technician_requirements
    WHERE general_item_id = p_general_item_id
    ON CONFLICT (project_item_id, technician_type_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_auto_snapshot_project_item_requirements()
RETURNS TRIGGER AS $$
DECLARE
    v_project_type text;
BEGIN
    IF NEW.general_item_id IS NOT NULL THEN
        SELECT project_type INTO v_project_type
        FROM public.projects
        WHERE id = NEW.project_id;

        IF v_project_type = 'contracting' THEN
            PERFORM public.snapshot_project_item_requirements_from_general_item(NEW.id, NEW.general_item_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_project_items_auto_snapshot_requirements ON public.project_items;
CREATE TRIGGER trg_project_items_auto_snapshot_requirements
AFTER INSERT ON public.project_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_snapshot_project_item_requirements();

-- 8. RLS Policies
ALTER TABLE public.technician_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_item_technician_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_item_technician_requirements ENABLE ROW LEVEL SECURITY;

-- technician_types RLS (Reference Catalog)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view technician_types" ON public.technician_types;
    DROP POLICY IF EXISTS "Admins can manage technician_types" ON public.technician_types;
    
    CREATE POLICY "Anyone can view technician_types" 
    ON public.technician_types FOR SELECT 
    USING (true);

    CREATE POLICY "Admins can manage technician_types" 
    ON public.technician_types FOR ALL 
    TO authenticated 
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END $$;

-- general_item_technician_requirements RLS (Internal Staffing Template - Authenticated Only)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view general_item_technician_requirements" ON public.general_item_technician_requirements;
    DROP POLICY IF EXISTS "Authenticated users can view general_item_technician_requirements" ON public.general_item_technician_requirements;
    DROP POLICY IF EXISTS "Admins can manage general_item_technician_requirements" ON public.general_item_technician_requirements;

    CREATE POLICY "Authenticated users can view general_item_technician_requirements" 
    ON public.general_item_technician_requirements FOR SELECT 
    TO authenticated
    USING (true);

    CREATE POLICY "Admins can manage general_item_technician_requirements" 
    ON public.general_item_technician_requirements FOR ALL 
    TO authenticated 
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END $$;

-- project_item_technician_requirements RLS (Internal Project Staffing - Authenticated Only)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view project_item_technician_requirements" ON public.project_item_technician_requirements;
    DROP POLICY IF EXISTS "Authenticated users can view project_item_technician_requirements" ON public.project_item_technician_requirements;
    DROP POLICY IF EXISTS "Admins and supervisors can manage project_item_technician_requirements" ON public.project_item_technician_requirements;

    CREATE POLICY "Authenticated users can view project_item_technician_requirements" 
    ON public.project_item_technician_requirements FOR SELECT 
    TO authenticated
    USING (true);

    CREATE POLICY "Admins and supervisors can manage project_item_technician_requirements" 
    ON public.project_item_technician_requirements FOR ALL 
    TO authenticated 
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));
END $$;

-- 9. Security Definer Revocation
REVOKE ALL ON FUNCTION public.snapshot_project_item_requirements_from_general_item(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_project_item_requirements_from_general_item(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trg_auto_snapshot_project_item_requirements() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_auto_snapshot_project_item_requirements() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.propagate_technician_type_rename() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.propagate_technician_type_rename() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.sync_technician_specialty() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_technician_specialty() TO postgres, service_role;
