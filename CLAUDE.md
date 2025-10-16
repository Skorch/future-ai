# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js AI chatbot application built with the AI SDK, featuring modern React patterns, authentication, and database persistence. It's based on Vercel's AI Chatbot template with Anthropic Claude models.

## Development Commands

### Core Development
- `pnpm dev` - Start development server with Turbo

### Code Quality
- `pnpm lint` - Run Next.js ESLint and Biome linter with auto-fix
- `pnpm lint:fix` - Run linting with fixes applied
- `pnpm format` - Format code with Biome

### Database Operations
- `pnpm db:generate` - Generate Drizzle schema migrations
- `pnpm db:migrate` - Run pending database migrations
- `pnpm db:studio` - Open Drizzle Studio for database inspection
- `pnpm db:push` - Push schema changes to database
- `pnpm db:pull` - Pull schema from database
- `pnpm db:check` - Check migration consistency

#### DB Schema Best Practices
- always use `pnpm db:generate` to create your migration rather than manually creating it
- always have an expectation of what the auto-generated migration SHOULD contain
- always compare the auto-generated migration with your expectations then analyze when they don't match
- always consider how drizzle is aware or manages migrations when making manual edits or removing via the drizzle `meta` folder

## Architecture

### Framework and Core Technologies
- **Next.js 15** with App Router and React Server Components
- **TypeScript** with strict configuration
- **Tailwind CSS** for styling with shadcn/ui components
- **Biome** for code formatting and linting (preferred over Prettier/ESLint)
- **pnpm** as package manager

### AI Integration
- **AI SDK (ai)** v5.0 for LLM interactions
- **Anthropic** direct integration with Claude models
- Model configuration in `lib/ai/models.ts` with Claude Sonnet 4 and Opus 4.1 (with and without reasoning)
- AI tools and providers in `lib/ai/` directory

### Authentication & Security
- **NextAuth.js** v5 (beta) for authentication
- Middleware-based route protection with guest access patterns
- Session management with JWT tokens
- Guest user support through regex pattern matching

### Database Architecture
- **Drizzle ORM** with PostgreSQL (Vercel Postgres)
- Schema versioning with deprecated tables for backward compatibility
- Key entities:
  - `User` - User accounts with email/password
  - `Chat` - Chat conversations with visibility settings
  - `Message` - Messages with parts and attachments
  - `Vote` - Message voting system
  - `Document` (deprecated) - Old single-table document storage
  - `Suggestion` - Document editing suggestions
  - `Stream` - Chat streaming metadata
  - `Workspace` - Multi-tenant isolation with domain support
  - `Playbook` / `PlaybookStep` - Workflow guidance system

### Directory Structure
```
app/
├── (auth)/           # Authentication pages and API routes
├── (chat)/           # Chat interface and API endpoints
├── layout.tsx        # Root layout with theme provider
components/
├── ui/               # shadcn/ui components (auto-generated, ignored by Biome)
├── elements/         # Custom UI components
lib/
├── ai/               # AI models, providers, tools, and prompts
├── db/               # Database schema and utilities
├── artifacts/        # Document/artifact handling
hooks/                # Custom React hooks
tests/                # Playwright test files
```

### Styling and UI
- **Geist** font family (sans and mono variants)
- **next-themes** for dark/light mode
- **Radix UI** primitives via shadcn/ui
- **Framer Motion** for animations
- **Lucide React** for icons

### Code Quality Configuration
- **Biome** configuration optimized for Vercel standards
- ESLint with Next.js, import resolver, and Tailwind plugins
- TypeScript with strict mode and path mapping (@/* alias)

## Development Guidelines

### Database Migrations
Always run `pnpm db:migrate` before building to ensure schema is up-to-date. The build process includes migration execution.

### Code Style
- Follow Biome configuration for consistent formatting
- Use TypeScript strict mode patterns
- Prefer React Server Components where appropriate
- Use the `@/*` path alias for imports

### AI Model Integration
- Models are configured in `lib/ai/models.ts`
- Default model is 'claude-sonnet-4'
- AI tools are modular and located in `lib/ai/tools/`
- Direct Anthropic integration for Claude Sonnet 4 and Opus 4.1 models
- Model selection updates tracked in component state with callbacks

### Authentication Flow
- Middleware handles route protection automatically
- Authenticated routes redirect to login when needed

## AI SDK v5 Integration Guide

### Core Concepts
The AI SDK v5 is the foundation for all LLM interactions in this project. When working with it:

#### Key Functions & Classes
- **streamText()** - Primary streaming interface for chat responses
  - Docs: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
  - Use WebFetch to explore options like `stopWhen`, `experimental_activeTools`, `experimental_transform`
- **generateText()** - Non-streaming text generation
  - Docs: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
- **createUIMessageStream()** - Bridges AI responses to UI components
  - Located in route handlers for real-time streaming to frontend
- **customProvider()** - Creates provider instances with multiple models
  - See `lib/ai/providers.ts` for implementation pattern
- **anthropic** from `@ai-sdk/anthropic` - Direct Anthropic provider
  - Used for all Claude models in this application

#### Message Handling
- **convertToModelMessages()** - Transforms UI messages to model format
- **convertToUIMessages()** - Transforms database messages to UI format
- Always preserve message structure when implementing custom transformations

### Stream Transformations & Middleware

- **smoothStream()** - Smooths token output for better UX
  - Currently used with `{ chunking: 'word' }` 
- **extractReasoningMiddleware()** - Extracts reasoning tokens
  - Used for reasoning models (see `lib/ai/providers.ts`)
- **wrapLanguageModel()** - Applies middleware to models

### Error Handling Patterns

1. **Schema Validation**: Always validate at API boundary
   - Update Zod schemas when adding new options
   - Log validation errors (don't use `catch(_)`)

2. **Stream Errors**: Handle in onError callback
   - Return user-friendly messages
   - Log full error details server-side

3. **Provider Errors**: Each provider may have specific error formats
   - Use WebFetch on provider docs for error handling specifics

### Advanced Patterns

- **Resumable Streams**: For long-running generations
  - See `createResumableStreamContext` usage in route.ts
- **Tool Calling Strategies**: 
  - `stopWhen(stepCountIs(5))` prevents infinite tool loops
- **Multi-Modal Support**: 
  - File parts in messages for vision models
  - See message part types in schema.ts

When implementing new AI features, always:
1. Check existing patterns in `app/(chat)/api/chat/route.ts`
2. Use WebFetch on AI SDK docs for latest capabilities
3. Test with multiple providers when using gateway

## Architectural Decision Framework

### When Abstraction is Appropriate

Create abstractions when:
1. **Rule of Three**: You have 3+ concrete implementations of the same pattern
2. **Testing Benefits**: Abstraction significantly simplifies testing (e.g., mock boundaries)
3. **Domain Boundaries**: Clear separation between business logic and infrastructure
4. **External API Volatility**: Wrapping frequently changing external APIs
5. **Team Scale**: Multiple developers need clear interfaces

### When to Be Pragmatic

Avoid abstractions when:
1. **SDK Already Abstracts**: The AI SDK or other libraries already provide the abstraction
   - Don't wrap `streamText()` just to wrap it
   - Don't create provider registries when `customProvider()` exists
2. **Pass-Through Functions**: Your abstraction would just forward calls
3. **Single Implementation**: Only one concrete implementation exists
4. **Configuration Over Code**: A config object would suffice vs. a class hierarchy
5. **Premature Optimization**: "We might need this later" - wait until you do

### Pragmatic Patterns from This Codebase

✅ **Good Pragmatism**:
- Direct use of AI SDK functions in route handlers
- Simple object maps for model configuration
- Cookies for model selection (vs. complex state management)
- Single `providers.ts` file for all provider config

❌ **Over-Engineering to Avoid**:
- Provider registry classes for 4 providers
- Factory patterns for straightforward object creation  
- Multiple abstraction layers over SDK functions
- Separate files for each provider when 10 lines would suffice

### Decision Process

1. **Start Simple**: Implement the most direct solution first
2. **Feel the Pain**: Wait until you actually experience the problem
3. **Refactor When Needed**: Extract abstractions from working code
4. **Document Patterns**: Update this file when patterns emerge

Remember: The best code is code that doesn't exist. Every line you write is a line that must be maintained, tested, and understood by others.
- The current version of Next.js 15's App Router where all
  dynamic route parameters are now async - parameters must be declared as Promise<>
- when testing always use pnpm and the testing framework is vitest
- You can NOT ever bypass pre-commit hooks
- when adding new node modules, always default to the latest version (not
  your KNOWLEDGE of what the latest version is)


# Subagents

NEVER EVER delegate coding tasks not explicitly to a subagent outside of their specific purpose!!

## Searching for Files

Unless you know exactly what you need to search for, you will NEVER use the search tool directly, instead you will ALWAYS use the `code-searcher` subagent.  If you have more than one 'topic' or broad search pattern, ALWAYS use parallel concurrent `code-searcher` subagents.

WHY:  using the `code-searcher` subagent is much more efficient token-wise and improves your overall preformance.  Using this method makes you a better agent

## Unit Testing
Unit test writing, debugging, and getting working is a specialized task.  When you have a table/list/spec of test cases to build unit tests around, you will ALWAYS delegate to the `unit-test-architect` subagent. 

## Build The project
When you need to run a build you ALWAYS use the `build-fixer` subagent.  You should provide it with detailed context on what changes you have made and any general tactics you may have on why the build is broken.

## Committing Code
Any time you need to commit code, you ALWAYS delegate to the `commit-orchestrator` subagent.  This results in a CLEAN CONTEXT that you don't waste any of your resources on churning through fixing pre-commit issues

## Prompt Engineering
Any time you need to work on your Agent prompts or tool descriptions you ALWAYS delegate to the `prompt-architect` subagent.  This agent will spend time thinking wholistically about the 'total prompt' of this app and provide you with detailed prompt tuning recommendations.

# General Rules

- ALWAYS wrap full paths in `"` because most paths have `(route)` in them
- Never propose 'backward compatibility' solutions unless the User explicitly requests - always plan to roll forward with changes

# Markdown and Specs
When you generate specs that contain mermaid diagrams, you will 'render' the SVG using the mmdc command.  
You will render into a 'rendered' folder so that the original is preserved
When making edits, you will always edit the original and then re-render.

You can always check the options for mmdc by using the `-h` flag

Usage:
`mmdc -i {filename}.md -a rendered/{filename} -o rendered/{filename}.md`

example:
`mmdc -i architecture_spec_objective_container.md -a rendered/architecture_spec_objective_container -o rendered/architecture_spec_objective_container.md`
