import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  index,
  integer,
  unique,
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: varchar('id', { length: 255 }).primaryKey(), // Clerk user ID directly
  email: varchar('email', { length: 256 }).notNull(),
  firstName: varchar('firstName', { length: 256 }),
  lastName: varchar('lastName', { length: 256 }),
  imageUrl: text('imageUrl'),
  emailVerified: boolean('emailVerified').default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

// Workspace table for multi-tenant isolation
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
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    lastAccessedAt: timestamp('lastAccessedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete
  },
  (table) => ({
    // Composite index for efficient workspace queries
    userWorkspaceIdx: index('user_workspace_idx').on(table.userId, table.id),
    workspaceDomainIdx: index('workspace_domain_idx').on(table.domainId),
  }),
);

export type Workspace = InferSelectModel<typeof workspace>;

export const chat = pgTable(
  'Chat',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    userId: varchar('userId', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id, { onDelete: 'cascade' })
      .notNull(), // NEW
    visibility: varchar('visibility', { enum: ['public', 'private'] })
      .notNull()
      .default('private'),

    // Mode system columns - FIXED to camelCase
    mode: text('mode').default('discovery'),
    modeSetAt: timestamp('modeSetAt').defaultNow(), // was mode_set_at

    // Future milestone columns (can be null for now)
    goal: text('goal'),
    goalSetAt: timestamp('goalSetAt'), // was goal_set_at
    todoList: text('todoList'), // was todo_list
    todoListUpdatedAt: timestamp('todoListUpdatedAt'), // was todo_list_updated_at

    // Completion tracking fields
    complete: boolean('complete').default(false).notNull(),
    completedAt: timestamp('completedAt'), // was completed_at
    firstCompletedAt: timestamp('firstCompletedAt'), // was first_completed_at
  },
  (table) => ({
    // Composite index supports queries by workspace OR workspace+user
    workspaceUserIdx: index('workspace_user_idx').on(
      table.workspaceId,
      table.userId,
    ),
  }),
);

export type Chat = InferSelectModel<typeof chat>;

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
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('kind', { enum: ['text'] }) // Only 'text' is implemented
      .notNull()
      .default('text'),
    // NEW: Document type as first-class column (flexible string for dynamic types)
    documentType: text('documentType').notNull().default('text'),
    // NEW: Control whether document appears in RAG search results
    isSearchable: boolean('isSearchable').notNull().default(true),
    // NEW: Soft delete support (null = active, timestamp = deleted)
    deletedAt: timestamp('deletedAt'),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id, { onDelete: 'cascade' })
      .notNull(),
    createdByUserId: varchar('createdByUserId', { length: 255 }).references(
      () => user.id,
      {
        onDelete: 'set null',
      },
    ),
    metadata: json('metadata')
      .$type<{
        documentType?: string; // Keep for backward compatibility during migration
        fileName?: string;
        fileSize?: number;
        uploadedAt?: string;
        meetingDate?: string;
        participants?: string[];
        [key: string]: unknown;
      }>()
      .default({}),
    sourceDocumentIds: json('sourceDocumentIds').$type<string[]>().default([]),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
    workspaceIdx: index('workspace_idx').on(table.workspaceId),
    deletedAtIdx: index('idx_document_deleted_at').on(table.deletedAt),
    searchableIdx: index('idx_document_searchable').on(table.isSearchable),
    workspaceDeletedIdx: index('idx_document_workspace_deleted').on(
      table.workspaceId,
      table.deletedAt,
    ),
  }),
);

export type Document = InferSelectModel<typeof document>;

// Extended document type with computed fields for UI
export interface DocumentWithMetadata extends Document {
  documentType: string;
  characterCount: number;
  sourceChat?: {
    id: string;
    title: string;
  };
}

// Mode-Based Agent System
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

// Playbook tables for workflow guidance
export const playbook = pgTable('Playbook', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  description: text('description'),
  whenToUse: text('whenToUse'),
  domains: text('domains').array().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const playbookStep = pgTable(
  'PlaybookStep',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    playbookId: uuid('playbookId')
      .references(() => playbook.id, { onDelete: 'cascade' })
      .notNull(),
    sequence: integer('sequence').notNull(),
    instruction: text('instruction').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    uniqueSequence: unique().on(table.playbookId, table.sequence),
    playbookStepsIdx: index('playbook_steps_idx').on(
      table.playbookId,
      table.sequence,
    ),
  }),
);

export type Playbook = InferSelectModel<typeof playbook>;
export type PlaybookStep = InferSelectModel<typeof playbookStep>;

// Types for API responses
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
