-- Custom SQL migration file, put your code below! --

-- Seed playbooks (using UPSERT pattern for idempotency)
INSERT INTO "Playbook" (id, name, description, "whenToUse", domains, "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'process-knowledge',
    'Process raw knowledge into summary',
    'When user uploads transcript or raw knowledge',
    ARRAY['sales', 'engineering'],
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'update-draft',
    'Update draft with punchlist changes',
    'After knowledge is processed and ready to update document',
    ARRAY['sales', 'engineering'],
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
  WHERE name IN ('process-knowledge', 'update-draft')
);

-- Insert fresh steps for process-knowledge
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
  (1, 'Generate summary from raw input', NULL, NULL),
  (2, 'Ask user to approve summary', NULL, NULL),
  (3, 'Save knowledge document', 'saveKnowledge', 'if user approves'),
  (4, 'Ask: Generate new draft?', NULL, NULL)
) AS s(sequence, instruction, "toolCall", condition)
WHERE p.name = 'process-knowledge';

-- Insert fresh steps for update-draft
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
  (1, 'Load current objective document', 'loadDocument', NULL),
  (2, 'Generate punchlist from knowledge', 'generateDocumentVersion', 'targetField=punchlist'),
  (3, 'Show punchlist changes to user', NULL, NULL),
  (4, 'Regenerate document from punchlist', 'generateDocumentVersion', 'targetField=content')
) AS s(sequence, instruction, "toolCall", condition)
WHERE p.name = 'update-draft';
