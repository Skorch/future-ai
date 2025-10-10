CREATE TYPE "public"."knowledge_category" AS ENUM('knowledge', 'raw');--> statement-breakpoint
CREATE TYPE "public"."objective_status" AS ENUM('open', 'published');--> statement-breakpoint
CREATE TABLE "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" varchar(255) NOT NULL,
	"objectiveId" uuid NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"mode" text DEFAULT 'discovery',
	"modeSetAt" timestamp DEFAULT now(),
	"goal" text,
	"goalSetAt" timestamp,
	"todoList" text,
	"todoListUpdatedAt" timestamp,
	"complete" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp,
	"firstCompletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "ObjectiveDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"title" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdByUserId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ObjectiveDocumentVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"chatId" uuid,
	"content" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"metadata" json,
	"versionNumber" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByUserId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KnowledgeDocument" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objectiveId" uuid,
	"workspaceId" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" "knowledge_category" NOT NULL,
	"documentType" text NOT NULL,
	"isSearchable" boolean DEFAULT true NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByUserId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Objective" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"objectiveDocumentId" uuid,
	"title" text NOT NULL,
	"description" text,
	"documentType" text NOT NULL,
	"status" "objective_status" DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"createdByUserId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Playbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"whenToUse" text,
	"domains" text[] NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Playbook_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "PlaybookStep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playbookId" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"instruction" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Stream" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Stream_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(256) NOT NULL,
	"firstName" varchar(256),
	"lastName" varchar(256),
	"imageUrl" text,
	"emailVerified" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Vote" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
CREATE TABLE "Workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"domainId" varchar(50) DEFAULT 'sales' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastAccessedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_objectiveId_Objective_id_fk" FOREIGN KEY ("objectiveId") REFERENCES "public"."Objective"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ObjectiveDocument" ADD CONSTRAINT "ObjectiveDocument_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ObjectiveDocument" ADD CONSTRAINT "ObjectiveDocument_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ObjectiveDocumentVersion" ADD CONSTRAINT "ObjectiveDocumentVersion_documentId_ObjectiveDocument_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."ObjectiveDocument"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ObjectiveDocumentVersion" ADD CONSTRAINT "ObjectiveDocumentVersion_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ObjectiveDocumentVersion" ADD CONSTRAINT "ObjectiveDocumentVersion_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_objectiveId_Objective_id_fk" FOREIGN KEY ("objectiveId") REFERENCES "public"."Objective"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_objectiveDocumentId_ObjectiveDocument_id_fk" FOREIGN KEY ("objectiveDocumentId") REFERENCES "public"."ObjectiveDocument"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PlaybookStep" ADD CONSTRAINT "PlaybookStep_playbookId_Playbook_id_fk" FOREIGN KEY ("playbookId") REFERENCES "public"."Playbook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_objective" ON "Chat" USING btree ("objectiveId");--> statement-breakpoint
CREATE INDEX "idx_chat_user" ON "Chat" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_objective_document_workspace" ON "ObjectiveDocument" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "idx_objective_version_document" ON "ObjectiveDocumentVersion" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "idx_objective_version_chat" ON "ObjectiveDocumentVersion" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX "idx_knowledge_objective" ON "KnowledgeDocument" USING btree ("objectiveId");--> statement-breakpoint
CREATE INDEX "idx_knowledge_workspace" ON "KnowledgeDocument" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "idx_knowledge_category" ON "KnowledgeDocument" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_knowledge_searchable" ON "KnowledgeDocument" USING btree ("isSearchable");--> statement-breakpoint
CREATE INDEX "idx_objective_workspace" ON "Objective" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "idx_objective_status" ON "Objective" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_objective_document" ON "Objective" USING btree ("objectiveDocumentId");--> statement-breakpoint
CREATE UNIQUE INDEX "playbook_step_unique_seq" ON "PlaybookStep" USING btree ("playbookId","sequence");--> statement-breakpoint
CREATE INDEX "playbook_steps_idx" ON "PlaybookStep" USING btree ("playbookId","sequence");--> statement-breakpoint
CREATE INDEX "user_workspace_idx" ON "Workspace" USING btree ("userId","id");--> statement-breakpoint
CREATE INDEX "workspace_domain_idx" ON "Workspace" USING btree ("domainId");