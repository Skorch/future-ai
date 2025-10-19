-- Custom SQL migration file, put your code below! --

-- ===== SALES INTELLIGENCE =====

-- Sales Strategy (objective document type)
UPDATE "ArtifactType"
SET
  "label" = 'Strategy',
  "title" = 'Sales Strategy',
  "description" = 'Strategic recommendations and win probability assessment for this opportunity'
WHERE "title" = 'Sales Strategy';

-- Sales Call Summary (summary type)
UPDATE "ArtifactType"
SET
  "label" = 'Summary',
  "title" = 'Call Summary',
  "description" = 'AI-generated summary of sales call transcripts with key insights'
WHERE "title" = 'Sales Call Summary';

-- Sales Punchlist (punchlist type)
UPDATE "ArtifactType"
SET
  "label" = 'Punchlist',
  "title" = 'Sales Punchlist',
  "description" = 'Track qualification progress, risks, and next steps for this deal'
WHERE "title" = 'Sales Punchlist';

-- Sales Workspace Context (context type)
UPDATE "ArtifactType"
SET
  "label" = 'Sales Process',
  "title" = 'Sales Team Intelligence',
  "description" = 'Team-wide sales processes, methodologies, and company information'
WHERE "title" = 'Sales Workspace Context';

-- Sales Objective Context (context type)
UPDATE "ArtifactType"
SET
  "label" = 'Sales Goal',
  "title" = 'Sales Goal Details',
  "description" = 'Information about this specific sales opportunity and stakeholders'
WHERE "title" = 'Sales Objective Context';

-- ===== PROJECT INTELLIGENCE =====

-- Business Requirements (objective document type)
UPDATE "ArtifactType"
SET
  "label" = 'Requirements',
  "title" = 'Business Requirements',
  "description" = 'Comprehensive requirements documentation from discovery sessions'
WHERE "title" = 'Business Requirements';

-- Requirements Meeting Summary (summary type)
UPDATE "ArtifactType"
SET
  "label" = 'Summary',
  "title" = 'Meeting Summary',
  "description" = 'AI-generated summary of requirements gathering meetings'
WHERE "title" = 'Requirements Meeting Summary';

-- Project Punchlist (punchlist type)
UPDATE "ArtifactType"
SET
  "label" = 'Punchlist',
  "title" = 'Project Punchlist',
  "description" = 'Track requirements discovery, unknowns, and blockers for this project'
WHERE "title" = 'Project Punchlist';

-- Project Workspace Context (context type)
UPDATE "ArtifactType"
SET
  "label" = 'Project Process',
  "title" = 'Project Team Intelligence',
  "description" = 'Team-wide project management standards and organizational information'
WHERE "title" = 'Project Workspace Context';

-- Project Objective Context (context type)
UPDATE "ArtifactType"
SET
  "label" = 'Project Status',
  "title" = 'Project Status & Goals',
  "description" = 'Current status, requirements, and deliverables for this project'
WHERE "title" = 'Project Objective Context';