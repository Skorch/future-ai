-- Custom SQL migration file, put your code below! --

-- Seed new-objective playbook (using UPSERT pattern for idempotency)
INSERT INTO "Playbook" (id, name, description, "whenToUse", domains, "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'new-objective',
    'Initialize a new objective with transcript analysis',
    'When starting a fresh objective with an uploaded transcript',
    ARRAY['sales', 'engineering', 'meeting'],
    NOW(),
    NOW()
  )
ON CONFLICT (name)
DO UPDATE SET
  description = EXCLUDED.description,
  "whenToUse" = EXCLUDED."whenToUse",
  domains = EXCLUDED.domains,
  "updatedAt" = NOW();

-- Seed playbook steps
-- Delete existing steps first to ensure clean state
DELETE FROM "PlaybookStep"
WHERE "playbookId" IN (
  SELECT id FROM "Playbook"
  WHERE name = 'new-objective'
);

-- Insert fresh steps for new-objective
INSERT INTO "PlaybookStep" ("playbookId", sequence, instruction, "toolCall", condition, "createdAt", "updatedAt")
SELECT
  p.id,
  s.sequence,
  s.instruction,
  s."toolCall",
  s.condition,
  NOW(),
  NOW()
FROM "Playbook" p
CROSS JOIN (VALUES
  (1, 'Load and analyze the uploaded transcript to understand the context and key discussion points', 'loadKnowledge', NULL),
  (2, 'Generate a comprehensive summary of the transcript, highlighting key decisions, action items, and important context', NULL, NULL),
  (3, 'Based on the transcript analysis, define a clear and measurable objective goal, then update the objective with this goal', 'updateObjectiveGoal', NULL),
  (4, 'Create an actionable punchlist of specific tasks and deliverables based on the discussion in the transcript', NULL, NULL),
  (5, 'Provide 3-5 helpful next steps the user should take to progress this objective forward', NULL, NULL)
) AS s(sequence, instruction, "toolCall", condition)
WHERE p.name = 'new-objective';