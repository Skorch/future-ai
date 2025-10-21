CREATE TABLE "PlaybookDomain" (
	"playbookId" uuid NOT NULL,
	"domainId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PlaybookDomain_playbookId_domainId_pk" PRIMARY KEY("playbookId","domainId")
);
--> statement-breakpoint
ALTER TABLE "PlaybookDomain" ADD CONSTRAINT "PlaybookDomain_playbookId_Playbook_id_fk" FOREIGN KEY ("playbookId") REFERENCES "public"."Playbook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PlaybookDomain" ADD CONSTRAINT "PlaybookDomain_domainId_Domain_id_fk" FOREIGN KEY ("domainId") REFERENCES "public"."Domain"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_playbook_domain_playbook" ON "PlaybookDomain" USING btree ("playbookId");--> statement-breakpoint
CREATE INDEX "idx_playbook_domain_domain" ON "PlaybookDomain" USING btree ("domainId");--> statement-breakpoint
-- Data migration: Convert legacy domain strings to domain UUIDs via junction table
-- Map: 'sales' -> 'Sales Intelligence', 'engineering'|'project'|'meeting' -> 'Project Intelligence'
INSERT INTO "PlaybookDomain" ("playbookId", "domainId", "createdAt")
SELECT DISTINCT
  p.id AS "playbookId",
  d.id AS "domainId",
  NOW() AS "createdAt"
FROM "Playbook" p
CROSS JOIN LATERAL unnest(p.domains) AS domain_str
JOIN "Domain" d ON (
  (domain_str = 'sales' AND d.title = 'Sales Intelligence') OR
  (domain_str IN ('engineering', 'project', 'meeting') AND d.title = 'Project Intelligence')
)
ON CONFLICT ("playbookId", "domainId") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "Playbook" DROP COLUMN "domains";