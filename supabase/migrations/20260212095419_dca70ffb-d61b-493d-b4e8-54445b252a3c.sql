
-- Backfill phase_number for existing phases (per project, ordered by order_index)
WITH numbered AS (
  SELECT id, project_id, 
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY order_index, created_at) as rn
  FROM project_phases
)
UPDATE project_phases 
SET phase_number = numbered.rn
FROM numbered 
WHERE project_phases.id = numbered.id;

-- Backfill reference_number for existing phases (global order by created_at)
WITH global_numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM project_phases
)
UPDATE project_phases 
SET reference_number = global_numbered.rn || '/26'
FROM global_numbered 
WHERE project_phases.id = global_numbered.id;

-- Update the sequence counter to reflect existing phases
INSERT INTO phase_reference_seq (year, last_number) 
VALUES (2026, (SELECT COUNT(*) FROM project_phases))
ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number;
