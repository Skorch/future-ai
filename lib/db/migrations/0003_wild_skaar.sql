ALTER TABLE "Workspace" ADD COLUMN "domainId" varchar(50) DEFAULT 'sales' NOT NULL;--> statement-breakpoint
CREATE INDEX "workspace_domain_idx" ON "Workspace" USING btree ("domainId");