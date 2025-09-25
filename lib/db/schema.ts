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
} from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

// Workspace table for multi-tenant isolation
export const workspace = pgTable(
  'Workspace',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .references(() => user.id)
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    lastAccessedAt: timestamp('lastAccessedAt').defaultNow().notNull(),
    deletedAt: timestamp('deletedAt'), // Soft delete
  },
  (table) => ({
    // Composite index for efficient workspace queries
    userWorkspaceIdx: index('user_workspace_idx').on(table.userId, table.id),
  }),
);

export type Workspace = InferSelectModel<typeof workspace>;

export const chat = pgTable(
  'Chat',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id)
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
    .references(() => chat.id),
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
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
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
    kind: varchar('kind', { enum: ['text', 'code'] }) // FIXED column name and added 'code'
      .notNull()
      .default('text'),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id)
      .notNull(), // CHANGED from userId
    createdByUserId: uuid('createdByUserId').references(() => user.id), // NEW - track creator
    // NEW FIELDS for RAG simplification
    metadata: json('metadata')
      .$type<{
        documentType?: 'transcript' | 'meeting-summary';
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
  }),
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    workspaceId: uuid('workspaceId')
      .references(() => workspace.id)
      .notNull(), // CHANGED from userId
    suggestedByUserId: uuid('suggestedByUserId').references(() => user.id), // NEW - track suggester
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    workspaceIdx: index('suggestion_workspace_idx').on(table.workspaceId),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

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
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;
