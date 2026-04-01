
ALTER TABLE public.project_phases
ADD COLUMN has_percentage boolean NOT NULL DEFAULT false,
ADD COLUMN percentage_value numeric NOT NULL DEFAULT 0;
