import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  json,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const objectiveStatusEnum = pgEnum('objective_status', [
  'open',
  'published',
]);
export const knowledgeCategoryEnum = pgEnum('knowledge_category', [
  'knowledge',
  'raw',
]);
export const sourceTypeEnum = pgEnum('source_type', [
  'transcript',
  'email',
  'slack',
  'note',
]);

// User table (Clerk-based authentication)
export const user = pgTable('User', {
  id: varchar('id', { length: 255 }).primaryKey(), // Clerk user ID
  email: varchar('email', { length: 256 }).notNull(),
  firstName: varchar('firstName', { length: 256 }),
  lastName: varchar('lastName', { length: 256 }),
  imageUrl: text('imageUrl'),
  emailVerified: boolean('emailVerified').default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

// Workspace table (with soft delete)
export const workspace = pgTable(
  'Workspace',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('userId', { length: 255 })
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    domainId: varchar('domainId', { length: 50 }).notNull().default('sales'),
    context: text('context'), // Workspace-specific AI instructions (markdown)
    contextUpdatedAt: timestamp('contextUpdatedAt'), // Last context update timestamp
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    lastAccessedAt: timestamp('lastAccessedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete
  },
  (table) => ({
    userWorkspaceIdx: index('user_workspace_idx').on(table.userId, table.id),
    workspaceDomainIdx: index('workspace_domain_idx').on(table.domainId),
  }),
);

export type Workspace = InferSelectModel<typeof workspace>;

// ObjectiveDocument table (defined FIRST for FK reference from Objective)
export const objectiveDocument = pgTable(
  'ObjectiveDocument',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    createdByUserId: varchar('createdByUserId', { length: 255 })
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index('idx_objective_document_workspace').on(
      table.workspaceId,
    ),
  }),
);

export type ObjectiveDocument = InferSelectModel<typeof objectiveDocument>;

// Objective table (references ObjectiveDocument via objectiveDocumentId)
export const objective = pgTable(
  'Objective',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id, { onDelete: 'cascade' })
      .notNull(),
    objectiveDocumentId: uuid('objectiveDocumentId').references(
      () => objectiveDocument.id,
      { onDelete: 'set null' },
    ), // Natural 1:1
    title: text('title').notNull(),
    description: text('description'),
    documentType: text('documentType').notNull(),
    status: objectiveStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
    publishedAt: timestamp('publishedAt'),
    createdByUserId: varchar('createdByUserId', { length: 255 })
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index('idx_objective_workspace').on(table.workspaceId),
    statusIdx: index('idx_objective_status').on(table.status),
    documentIdx: index('idx_objective_document').on(table.objectiveDocumentId),
  }),
);

export type Objective = InferSelectModel<typeof objective>;

// Chat table (MODIFIED - workspaceId REMOVED, objectiveId ADDED)
export const chat = pgTable(
  'Chat',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    userId: varchar('userId', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // REMOVED: workspaceId - no longer needed (access via objective)
    objectiveId: uuid('objectiveId')
      .references(() => objective.id, { onDelete: 'cascade' })
      .notNull(), // NEW REQUIRED FIELD
    objectiveDocumentVersionId: uuid('objectiveDocumentVersionId').references(
      () => objectiveDocumentVersion.id,
      { onDelete: 'set null' },
    ), // FK to version (one chat = one version)
    // Mode system fields
    mode: text('mode').default('discovery'),
    modeSetAt: timestamp('modeSetAt').defaultNow(),
    goal: text('goal'),
    goalSetAt: timestamp('goalSetAt'),
    todoList: text('todoList'),
    todoListUpdatedAt: timestamp('todoListUpdatedAt'),
    complete: boolean('complete').default(false).notNull(),
    completedAt: timestamp('completedAt'),
    firstCompletedAt: timestamp('firstCompletedAt'),
  },
  (table) => ({
    objectiveIdx: index('idx_chat_objective').on(table.objectiveId),
    userIdx: index('idx_chat_user').on(table.userId),
    versionIdx: index('idx_chat_version').on(table.objectiveDocumentVersionId),
  }),
);

export type Chat = InferSelectModel<typeof chat>;

// ObjectiveDocumentVersion table (FK relationship inverted - Chat now references Version)
export const objectiveDocumentVersion = pgTable(
  'ObjectiveDocumentVersion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('documentId')
      .references(() => objectiveDocument.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    punchlist: text('punchlist'), // Markdown-formatted punchlist tracking document evolution
    kind: text('kind').notNull().default('text'), // Document type (for backwards compatibility)
    metadata: json('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('createdAt').defaultNow().notNull(), // Latest = MAX(createdAt)
    createdByUserId: varchar('createdByUserId', { length: 255 })
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    documentIdx: index('idx_objective_version_document').on(table.documentId),
  }),
);

export type ObjectiveDocumentVersion = InferSelectModel<
  typeof objectiveDocumentVersion
>;

// KnowledgeDocument table
export const knowledgeDocument = pgTable(
  'KnowledgeDocument',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    objectiveId: uuid('objectiveId').references(() => objective.id, {
      onDelete: 'set null',
    }),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: knowledgeCategoryEnum('category').notNull(),
    documentType: text('documentType').notNull(),
    isSearchable: boolean('isSearchable').notNull().default(true),
    metadata: json('metadata').$type<Record<string, unknown>>(),
    // Source metadata (first-class columns for Phase 3)
    sourceType: sourceTypeEnum('sourceType'),
    sourceDate: timestamp('sourceDate'),
    participants:
      json('participants').$type<
        Array<{
          email?: string;
          displayName: string;
        }>
      >(),
    sourceKnowledgeDocumentId: uuid('sourceKnowledgeDocumentId'), // Self-reference without .references()
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    createdByUserId: varchar('createdByUserId', { length: 255 })
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    objectiveIdx: index('idx_knowledge_objective').on(table.objectiveId),
    workspaceIdx: index('idx_knowledge_workspace').on(table.workspaceId),
    categoryIdx: index('idx_knowledge_category').on(table.category),
    searchableIdx: index('idx_knowledge_searchable').on(table.isSearchable),
    sourceIdx: index('idx_knowledge_source').on(
      table.sourceKnowledgeDocumentId,
    ),
    sourceDateIdx: index('idx_knowledge_source_date').on(table.sourceDate),
    sourceTypeIdx: index('idx_knowledge_source_type').on(table.sourceType),
    // Add self-referencing FK constraint using foreignKey()
    sourceFk: foreignKey({
      columns: [table.sourceKnowledgeDocumentId],
      foreignColumns: [table.id],
      name: 'KnowledgeDocument_sourceKnowledgeDocumentId_fk',
    }).onDelete('set null'),
  }),
);

export type KnowledgeDocument = InferSelectModel<typeof knowledgeDocument>;

// Message table (unchanged)
export const message = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// Vote table (unchanged)
export const vote = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  }),
);

export type Vote = InferSelectModel<typeof vote>;

// Stream table (unchanged)
export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
      name: 'Stream_chatId_Chat_id_fk',
    }).onDelete('cascade'),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

// Playbook table (unchanged)
export const playbook = pgTable('Playbook', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  description: text('description'),
  whenToUse: text('whenToUse'),
  domains: text('domains').array().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export type Playbook = InferSelectModel<typeof playbook>;

// PlaybookStep table (unchanged)
export const playbookStep = pgTable(
  'PlaybookStep',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playbookId: uuid('playbookId')
      .references(() => playbook.id, { onDelete: 'cascade' })
      .notNull(),
    sequence: integer('sequence').notNull(),
    instruction: text('instruction').notNull(),
    toolCall: varchar('toolCall', { length: 255 }), // Tool name for automatic execution
    condition: text('condition'), // Execution condition (e.g., 'if user approves')
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    uniqueSequence: uniqueIndex('playbook_step_unique_seq').on(
      table.playbookId,
      table.sequence,
    ),
    playbookStepsIdx: index('playbook_steps_idx').on(
      table.playbookId,
      table.sequence,
    ),
  }),
);

export type PlaybookStep = InferSelectModel<typeof playbookStep>;

// Mode-Based Agent System Types
export type ChatMode = 'discovery' | 'build';

export interface ModeContext {
  currentMode: ChatMode;
  goal: string | null;
  todoList: Todo[] | null;
  modeSetAt: Date;
  messageCount: number;
}

export interface Todo {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  order: number;
  attempts?: number;
}

export interface TodoList {
  version: number;
  todos: Todo[];
  lastUpdated: Date;
}

// API Response Types
export interface PlaybookWithSteps extends Playbook {
  steps: PlaybookStep[];
}

export interface PlaybookMetadata {
  id: string;
  name: string;
  description: string | null;
  whenToUse: string | null;
  domains: string[];
}

// Relations (for Drizzle ORM query builder)
export const userRelations = relations(user, ({ many }) => ({
  workspaces: many(workspace),
  objectives: many(objective),
  objectiveDocuments: many(objectiveDocument),
  knowledgeDocuments: many(knowledgeDocument),
  chats: many(chat),
}));

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  user: one(user, {
    fields: [workspace.userId],
    references: [user.id],
  }),
  objectives: many(objective),
  objectiveDocuments: many(objectiveDocument),
  knowledgeDocuments: many(knowledgeDocument),
}));

export const objectiveRelations = relations(objective, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [objective.workspaceId],
    references: [workspace.id],
  }),
  objectiveDocument: one(objectiveDocument, {
    fields: [objective.objectiveDocumentId],
    references: [objectiveDocument.id],
  }),
  createdBy: one(user, {
    fields: [objective.createdByUserId],
    references: [user.id],
  }),
  chats: many(chat),
  knowledgeDocuments: many(knowledgeDocument),
}));

export const objectiveDocumentRelations = relations(
  objectiveDocument,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [objectiveDocument.workspaceId],
      references: [workspace.id],
    }),
    createdBy: one(user, {
      fields: [objectiveDocument.createdByUserId],
      references: [user.id],
    }),
    versions: many(objectiveDocumentVersion),
  }),
);

export const objectiveDocumentVersionRelations = relations(
  objectiveDocumentVersion,
  ({ one }) => ({
    document: one(objectiveDocument, {
      fields: [objectiveDocumentVersion.documentId],
      references: [objectiveDocument.id],
    }),
    createdBy: one(user, {
      fields: [objectiveDocumentVersion.createdByUserId],
      references: [user.id],
    }),
  }),
);

export const knowledgeDocumentRelations = relations(
  knowledgeDocument,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [knowledgeDocument.workspaceId],
      references: [workspace.id],
    }),
    objective: one(objective, {
      fields: [knowledgeDocument.objectiveId],
      references: [objective.id],
    }),
    createdBy: one(user, {
      fields: [knowledgeDocument.createdByUserId],
      references: [user.id],
    }),
    sourceKnowledgeDocument: one(knowledgeDocument, {
      fields: [knowledgeDocument.sourceKnowledgeDocumentId],
      references: [knowledgeDocument.id],
    }),
  }),
);

export const chatRelations = relations(chat, ({ one, many }) => ({
  user: one(user, {
    fields: [chat.userId],
    references: [user.id],
  }),
  objective: one(objective, {
    fields: [chat.objectiveId],
    references: [objective.id],
  }),
  objectiveDocumentVersion: one(objectiveDocumentVersion, {
    fields: [chat.objectiveDocumentVersionId],
    references: [objectiveDocumentVersion.id],
  }),
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
  chat: one(chat, {
    fields: [message.chatId],
    references: [chat.id],
  }),
  votes: many(vote),
}));

export const voteRelations = relations(vote, ({ one }) => ({
  chat: one(chat, {
    fields: [vote.chatId],
    references: [chat.id],
  }),
  message: one(message, {
    fields: [vote.messageId],
    references: [message.id],
  }),
}));

export const playbookRelations = relations(playbook, ({ many }) => ({
  steps: many(playbookStep),
}));

export const playbookStepRelations = relations(playbookStep, ({ one }) => ({
  playbook: one(playbook, {
    fields: [playbookStep.playbookId],
    references: [playbook.id],
  }),
}));

// STUB: Legacy schema exports for Phase 1 build compatibility
// These were removed but some files still import them
// They will be removed completely in later phases
export const documentEnvelope = objectiveDocument; // Stub mapping
export const documentVersion = objectiveDocumentVersion; // Stub mapping
export const documentEnvelopeRelations = objectiveDocumentRelations; // Stub mapping
export const documentVersionRelations = objectiveDocumentVersionRelations; // Stub mapping

// Type aliases for backwards compatibility
export type DocumentVersion = ObjectiveDocumentVersion;
export type DocumentEnvelope = ObjectiveDocument;
export type Document = ObjectiveDocument; // Legacy Document type
export type DocumentWithVersions = {
  envelope: ObjectiveDocument;
  currentDraft: ObjectiveDocumentVersion | null;
  currentPublished: ObjectiveDocumentVersion | null;
  allVersions: ObjectiveDocumentVersion[];
};
