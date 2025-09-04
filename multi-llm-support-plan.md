# Multi-LLM Provider Support Implementation Plan

## Current State Analysis
- **Current Provider**: xAI (Grok models only)
- **Architecture**: Uses Vercel AI SDK v5.0.26 with custom provider pattern
- **Gateway**: Uses `@ai-sdk/gateway` for xAI integration

## Target LLMs
- Claude Sonnet 4
- Opus 4.1
- GPT 5
- Gemini 2.5 Pro

## File Tree with Actions

```
📁 nextjs-ai-chatbot-poc/
│
├── 📁 lib/ai/
│   ├── 📄 models.ts                    [MODIFY] - Add new model definitions with provider info
│   ├── 📄 providers.ts                 [MODIFY] - Add multiple provider configurations
│   ├── 📄 provider-registry.ts         [ADD]    - New centralized provider registry
│   ├── 📄 entitlements.ts              [MODIFY] - Update with new model IDs
│   ├── 📄 prompts.ts                   [MODIFY] - Add provider-specific prompts
│   ├── 📁 providers/
│   │   ├── 📄 anthropic.ts            [ADD]    - Anthropic provider configuration
│   │   ├── 📄 openai.ts               [ADD]    - OpenAI provider configuration
│   │   ├── 📄 google.ts               [ADD]    - Google provider configuration
│   │   ├── 📄 xai.ts                  [ADD]    - Extract existing xAI config
│   │   └── 📄 types.ts                [ADD]    - Provider interface definitions
│   └── 📁 tools/                      [REFERENCE] - May need provider-specific adjustments
│       ├── create-document.ts
│       ├── update-document.ts
│       ├── request-suggestions.ts
│       └── get-weather.ts
│
├── 📁 components/
│   ├── 📄 model-selector.tsx          [MODIFY] - Update UI to show provider & model
│   ├── 📄 chat.tsx                    [REFERENCE] - Passes model selection
│   ├── 📄 multimodal-input.tsx        [REFERENCE] - Uses selected model
│   └── 📄 provider-badge.tsx          [ADD]    - New component for provider branding
│
├── 📁 app/(chat)/
│   ├── 📄 api/chat/route.ts          [MODIFY] - Update model selection logic
│   ├── 📄 api/chat/schema.ts         [MODIFY] - Update schema for provider info
│   └── 📄 actions.ts                  [MODIFY] - Update title generation for multi-provider
│
├── 📁 app/(auth)/
│   └── 📄 auth.ts                     [REFERENCE] - May need provider-specific auth
│
├── 📁 artifacts/
│   ├── 📄 text/server.ts              [REFERENCE] - Uses myProvider
│   ├── 📄 code/server.ts              [REFERENCE] - Uses myProvider
│   └── 📄 sheet/server.ts             [REFERENCE] - Uses myProvider
│
├── 📄 .env.example                    [MODIFY] - Add new API key variables
├── 📄 .env.local                      [MODIFY] - Add actual API keys
├── 📄 package.json                    [MODIFY] - Add provider SDKs
└── 📄 types/index.ts                  [ADD]    - Global type definitions for providers
```

## ASCII Logic Flow for Multi-Provider Support

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐                                          │
│  │   Model Selector    │                                          │
│  │  ┌───────────────┐  │                                          │
│  │  │ Provider: ▼   │  │ ◄── Shows provider logo/name             │
│  │  ├───────────────┤  │                                          │
│  │  │ • Anthropic   │  │                                          │
│  │  │ • OpenAI      │  │                                          │
│  │  │ • Google      │  │                                          │
│  │  │ • xAI         │  │                                          │
│  │  └───────────────┘  │                                          │
│  │  ┌───────────────┐  │                                          │
│  │  │ Model: ▼      │  │ ◄── Filtered by provider                │
│  │  └───────────────┘  │                                          │
│  └─────────────────────┘                                          │
│           │                                                        │
│           ▼ selectedProvider + selectedModel                      │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────┐                        │
│  │      Provider Registry               │                        │
│  │  ┌────────────────────────────┐      │                        │
│  │  │ getProvider(providerId)    │      │                        │
│  │  │ getModel(providerId,       │      │                        │
│  │  │         modelId)           │      │                        │
│  │  └────────────┬───────────────┘      │                        │
│  │               │                       │                        │
│  │      ┌────────▼──────────┐           │                        │
│  │      │ Provider Config   │           │                        │
│  │      │ ┌──────────────┐  │           │                        │
│  │      │ │ apiKey       │  │           │                        │
│  │      │ │ baseURL      │  │           │                        │
│  │      │ │ headers      │  │           │                        │
│  │      │ │ rateLimit    │  │           │                        │
│  │      │ └──────────────┘  │           │                        │
│  │      └──────────────────┘           │                        │
│  └──────────────────────────────────────┘                        │
│                     │                                             │
│                     ▼                                             │
│  ┌──────────────────────────────────────┐                        │
│  │      Model Resolution                │                        │
│  │  ┌────────────────────────────┐      │                        │
│  │  │ IF provider === 'anthropic'│      │                        │
│  │  │   THEN use anthropicProvider│      │                        │
│  │  │ ELIF provider === 'openai' │      │                        │
│  │  │   THEN use openAIProvider  │      │                        │
│  │  │ ELIF provider === 'google' │      │                        │
│  │  │   THEN use googleProvider  │      │                        │
│  │  │ ELSE use xAIProvider       │      │                        │
│  │  └────────────────────────────┘      │                        │
│  └──────────────────────────────────────┘                        │
│                     │                                             │
└─────────────────────┼─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AI SDK LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────┐                        │
│  │      Provider Implementations        │                        │
│  ├──────────────────────────────────────┤                        │
│  │                                      │                        │
│  │  ┌─────────────┐  ┌─────────────┐   │                        │
│  │  │ Anthropic   │  │   OpenAI    │   │                        │
│  │  │ @ai-sdk/    │  │ @ai-sdk/    │   │                        │
│  │  │ anthropic   │  │ openai      │   │                        │
│  │  └─────────────┘  └─────────────┘   │                        │
│  │                                      │                        │
│  │  ┌─────────────┐  ┌─────────────┐   │                        │
│  │  │   Google    │  │     xAI     │   │                        │
│  │  │ @ai-sdk/    │  │ @ai-sdk/    │   │                        │
│  │  │ google      │  │ gateway     │   │                        │
│  │  └─────────────┘  └─────────────┘   │                        │
│  │                                      │                        │
│  └──────────────┬───────────────────────┘                        │
│                 │                                                 │
│                 ▼                                                 │
│  ┌──────────────────────────────────────┐                        │
│  │      streamText() Call               │                        │
│  │  ┌────────────────────────────┐      │                        │
│  │  │ model: provider.language   │      │                        │
│  │  │       Model(modelId)       │      │                        │
│  │  │ system: providerSpecific   │      │                        │
│  │  │        Prompt()            │      │                        │
│  │  │ tools: [...commonTools]    │      │                        │
│  │  └────────────────────────────┘      │                        │
│  └──────────────────────────────────────┘                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Environment Variables:                                            │
│  ┌────────────────────────────────────────┐                      │
│  │ ANTHROPIC_API_KEY=sk-ant-...           │                      │
│  │ OPENAI_API_KEY=sk-...                  │                      │
│  │ GOOGLE_API_KEY=...                     │                      │
│  │ AI_GATEWAY_API_KEY=... (xAI)           │                      │
│  └────────────────────────────────────────┘                      │
│                                                                   │
│  Model Configuration:                                             │
│  ┌────────────────────────────────────────┐                      │
│  │ {                                      │                      │
│  │   id: 'claude-sonnet-4',               │                      │
│  │   provider: 'anthropic',               │                      │
│  │   name: 'Claude Sonnet 4',             │                      │
│  │   capabilities: ['vision', 'tools'],   │                      │
│  │   context: 200000,                     │                      │
│  │   maxOutput: 8192                      │                      │
│  │ }                                      │                      │
│  └────────────────────────────────────────┘                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Install Provider SDKs**
   ```bash
   pnpm add @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google-vertex
   ```

2. **Create Provider Registry** (`lib/ai/provider-registry.ts`)
   - Central registry for all providers
   - Provider configuration management
   - API key validation

3. **Update Model Definitions** (`lib/ai/models.ts`)
   - Add provider field to ChatModel interface
   - Define all new models with provider info
   - Add capability flags (vision, reasoning, etc.)

### Phase 2: Provider Implementations
1. **Create Individual Provider Files**
   - `lib/ai/providers/anthropic.ts`
   - `lib/ai/providers/openai.ts`
   - `lib/ai/providers/google.ts`
   - `lib/ai/providers/xai.ts`

2. **Update Main Provider** (`lib/ai/providers.ts`)
   - Import all provider modules
   - Create dynamic provider selection logic
   - Handle provider-specific configurations

### Phase 3: UI Updates
1. **Enhance Model Selector**
   - Two-level selection (Provider → Model)
   - Show provider branding
   - Display model capabilities

2. **Update Chat Interface**
   - Pass provider info with model selection
   - Handle provider-specific features

### Phase 4: Business Logic
1. **Update Entitlements**
   - Add new model IDs to user tiers
   - Consider provider-specific limits

2. **Update Chat Route**
   - Handle provider selection
   - Route to correct provider instance
   - Provider-specific error handling

### Phase 5: Environment & Configuration
1. **Environment Variables**
   ```env
   # Anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # Google
   GOOGLE_API_KEY=...
   GOOGLE_PROJECT_ID=...
   
   # xAI (existing)
   AI_GATEWAY_API_KEY=...
   ```

2. **Provider-Specific Settings**
   - Rate limiting per provider
   - Retry logic
   - Timeout configurations

## Key Design Decisions

### 1. Provider Abstraction
- Use factory pattern for provider creation
- Maintain provider-agnostic interface for chat components
- Centralize provider configuration

### 2. Model Management
- Models include provider reference
- Capability-based filtering (vision, tools, etc.)
- Dynamic model availability based on API keys

### 3. Error Handling
- Provider-specific error mapping
- Graceful fallback when provider unavailable
- Clear user messaging for provider issues

### 4. Security
- API keys stored in environment variables
- Never expose keys to client
- Provider-specific authentication flows

## Migration Strategy
1. Keep existing xAI implementation working
2. Add new providers incrementally
3. Test each provider in isolation
4. Gradual rollout with feature flags
5. Monitor usage and errors per provider

## Testing Considerations
- Mock providers for testing (`models.test.ts`)
- Provider-specific test suites
- Integration tests for each provider
- Load testing for concurrent provider usage