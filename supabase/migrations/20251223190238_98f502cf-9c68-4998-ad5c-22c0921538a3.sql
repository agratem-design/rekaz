-- Fix projects with no items to have 0 progress
UPDATE projects 
SET progress = 0 
WHERE id IN (
  SELECT p.id 
  FROM projects p 
  LEFT JOIN project_items pi ON pi.project_id = p.id 
  GROUP BY p.id 
  HAVING COUNT(pi.id) = 0
);