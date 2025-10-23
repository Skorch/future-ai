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
DO NOT EVER genreate a migration manually

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
ALWAYS check the schema.ts to verify your understanding of the current DB schame design

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

### React Composition Pattern (For SOLID Principle Violations)

**Use this pattern when you see SOLID violations:**
- **Single Responsibility violated**: Parent and child both handling same concern (routing, API calls, state updates)
- **Open/Closed violated**: Adding boolean props to existing component instead of extending through composition
- **Multiple boolean props** controlling which components render (isEditing, isModal, showFooter, etc.)
- **Same component needs different behavior** in different contexts (modal vs sidebar vs bulk)

**Important**: You should use composition even with a single use case if it clearly violates SOLID principles. Don't wait for a second use case when the architecture is already wrong.

**DON'T use this pattern when:**
- You only have ONE implementation AND no SOLID violations (wait for the second use case)
- A simple callback prop would suffice
- The component has no state or complex behavior to share
- You're tempted to create unused "future-ready" code without clear violations

#### The Pattern: Provider + Primitives + Parent

```
Parent Component
  ├─ Owns side effects (routing, toasts, error handling)
  └─ <Provider> (business logic, state, API calls)
       └─ <Composition> (assembles UI)
            ├─ <Primitive /> (uses context for state/actions)
            └─ <Primitive /> (pure UI, no business logic)
```

**Layer Responsibilities:**

1. **Provider (Brain)** - Pure business logic, no framework dependencies
   - Owns ALL state (form data, loading states, validation)
   - Handles API calls and data transformations
   - Provides callbacks: `onSuccess(data)`, `onNavigate(url)`, `onError(err)`
   - Does NOT call router, show toasts, or handle side effects
   - Can be tested without Next.js or routing

2. **Primitives (Muscles)** - Pure UI, use context
   - Read from context via `useContext()` hook
   - Trigger context actions (no direct API calls)
   - Reusable across different compositions
   - Example: `<KnowledgeInput />`, `<SubmitButton />`

3. **Composition (Assembly)** - Picks which pieces to render
   - Chooses which primitives to include (no booleans needed)
   - Different compositions = different UIs with same provider
   - Example: Modal has upload + summarize, Sidebar just has quick-add

4. **Parent (Decision Maker)** - Owns ALL side effects
   - Wraps composition with provider
   - Implements provider callbacks (routing, refresh, toasts)
   - Handles errors with try/catch + logger + toast
   - Single source of truth for navigation

#### Key Principle: Lift State Higher

When components outside your UI frame need access to state/actions, lift the provider above both:

```tsx
// ❌ Before: Button outside modal can't access state
<ObjectiveKnowledgeModal>
  <Provider>
    <Dialog>
      <SubmitButton />  {/* Can access context */}
    </Dialog>
  </Provider>
</ObjectiveKnowledgeModal>
<SaveDraftButton />     {/* Can't access context - wrong scope */}

// ✅ After: Lift provider to include both
<Provider>
  <ObjectiveKnowledgeModal>
    <Dialog>
      <SubmitButton />      {/* Can access context */}
    </Dialog>
  </ObjectiveKnowledgeModal>
  <SaveDraftButton />       {/* Can access context - same scope */}
</Provider>
```

This is the Slack composer pattern - components don't need to be visually nested to share state.

#### Anti-Patterns to Avoid

- **Don't create providers "just in case"** - Wait until you have SOLID violations or 2+ use cases
- **Don't put routing in providers** - That's a side effect, belongs in parent
- **Don't make primitives with business logic** - They should only use context
- **Don't compose when a callback prop would work** - Keep it simple
- **Don't skip the provider and put everything in parent** - Lose testability

#### When You Need This Pattern

Ask these questions in order:
1. **Is there a SOLID violation?** (Parent + child both handle routing/API/state) → **Use composition now**
2. Do I have 3+ boolean props controlling what renders? → **Consider composition**
3. Do I need the same logic with different UIs? → **Share provider**
4. Is my component 200+ lines with complex conditionals? → **Decompose it**

The first question overrides all others. SOLID violations should be fixed immediately, even with a single use case.

#### Reference Implementation

- See `components/knowledge/` for complete example
- Fixed bug: Double router.refresh() causing duplicate chats
- Modal reduced 56% (195 → 86 lines) after refactor
- Search codebase for "FUTURE EXTENSIONS" comments showing how to extend
- Pattern inspired by [Slack's composer architecture](https://www.youtube.com/watch?v=XsjcB_VuSkU)


# Subagents

NEVER EVER delegate coding tasks not explicitly to a subagent outside of their specific purpose!!
Subagents may NEVER call other subagents

IMPORTANT:  Subagents start with a CLEAN CONTEXT - which means they don't know anything about your chat history.  The ONLY thing it knows is what you pass in as your prompt (as well as its own internal instructions).  Be sure to be clear in your Subagent Prompt and never refernece your own chat, instead be specific about that 'reference'.

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
- You NEVER use console.log.  Instead you use the common `lib/logger` for smarter logging levels

# GROWTH MINDSET

- if the User points out a gap in your thinking or corrects a plan (or other things like that), your goal is to LEARN from this interaction.  Instead of merely saying 'you are absolutely right', have a GROWTH MINDSET and state your original thinking (you had a reason afterall) and extra steps you may take next time to arrive at this conclusion in the first place.

