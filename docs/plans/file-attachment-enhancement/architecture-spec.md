# Architecture Specification: Enhanced File Attachment Support for Tool Calls

## Current State Analysis

### Problem Statement
The current implementation loads entire file contents (up to 80k tokens) into user messages, which then get passed through the entire LLM chain before reaching tool calls. This causes:
1. Excessive token consumption in the primary LLM call
2. Potential context window limitations
3. Inefficient processing where the LLM must decide what to do with massive content
4. The entire transcript is included in the message history, bloating future interactions

### Current Codeflow

```
1. USER INTERACTION LAYER
   └─> components/multimodal-input.tsx
       ├─> uploadFile() → POST /api/files/upload
       │   └─> Stores file in Vercel Blob, returns URL
       └─> submitForm() → sendMessage with file parts

2. MESSAGE PROCESSING LAYER
   └─> app/(chat)/api/chat/route.ts
       ├─> Receives message with file parts (URL, mediaType, name)
       ├─> processMessageFiles() [lib/ai/utils/file-processor.ts]
       │   ├─> Fetches file content from URL
       │   └─> Converts to text part: "File: [name]\n----\nFileContents:\n[content]"
       └─> streamText() with processed messages (containing full file content)

3. LLM DECISION LAYER
   └─> AI Model receives full transcript in message
       ├─> System prompt instructs to call createDocument for files
       └─> Decides to call createDocument tool

4. TOOL EXECUTION LAYER
   └─> lib/ai/tools/create-document.ts
       ├─> Receives title, kind, documentType, content (full transcript)
       └─> For meeting-summary: passes to meetingSummaryHandler

5. ARTIFACT GENERATION LAYER
   └─> artifacts/meeting-summary/server.ts
       ├─> Receives transcript in metadata
       └─> Makes SECOND streamText() call with full transcript
       └─> Generates and streams meeting summary
```

### Current Call Stack

```typescript
// 1. File Upload
MultimodalInput.handleFileChange()
  → fetch('/api/files/upload')
    → app/(chat)/api/files/upload/route.ts::POST()
      → put() // Vercel Blob storage

// 2. Message Submission
MultimodalInput.submitForm()
  → sendMessage({ parts: [{ type: 'file', url, name, mediaType }, { type: 'text', text }] })
    → fetch('/api/chat')

// 3. Chat Processing
app/(chat)/api/chat/route.ts::POST()
  → processMessageFiles(uiMessages) // file-processor.ts
    → fetch(file.url) // Downloads entire file
    → Combines into text part
  → streamText({
      messages: [{ content: "File: meeting.txt\n----\nFileContents:\n[80k tokens]" }],
      tools: { createDocument, ... }
    })

// 4. Tool Execution
AI calls: createDocument({ title, kind: "text", documentType: "meeting-summary", content: [80k tokens] })
  → createDocument.execute()
    → meetingSummaryHandler.onCreateDocument()
      → streamText({ prompt: "Create summary from:\n[80k tokens]" })
```

## AI SDK v5 Tool Calling Mechanism

### How Tool Definitions Work

The Vercel AI SDK v5 uses a sophisticated system to pass tool definitions to LLMs:

1. **Tool Definition Structure**
   ```typescript
   tool({
     description: string,        // Human-readable description for LLM
     inputSchema: ZodSchema,     // Zod schema defining parameters
     execute: async function     // Actual execution logic
   })
   ```

2. **Schema Conversion Process**
   - Zod schemas are converted to JSON Schema format internally
   - Each provider (OpenAI, Anthropic, etc.) receives a standardized format
   - The SDK handles provider-specific differences automatically

3. **Tool Registration in streamText()**
   ```typescript
   streamText({
     model: provider.languageModel('model-id'),
     tools: {
       toolName: tool({ ... }),  // Tool name becomes the function name
     },
     experimental_activeTools: ['toolName'],  // Controls which tools are available
   })
   ```

4. **LLM Tool Invocation**
   - The LLM receives tool definitions with their schemas
   - When deciding to use a tool, it generates a structured call matching the schema
   - The SDK validates the call against the Zod schema before execution

5. **Current File Handling Problem**
   - File content is embedded in messages BEFORE tool selection
   - LLM sees massive content, then decides to call createDocument
   - Tool receives the same content again, duplicating token usage

## Proposed Architecture

### Design Goals
1. **Lazy Loading**: Files are only fetched when needed by tools
2. **Efficiency**: Primary LLM sees file metadata, not content
3. **Flexibility**: Tools can decide how to process files
4. **Token Optimization**: Avoid passing large content through multiple LLM calls

### Refactored Codeflow

```
1. USER INTERACTION LAYER (unchanged)
   └─> components/multimodal-input.tsx
       └─> Uploads file, gets URL

2. MESSAGE PROCESSING LAYER (MODIFIED)
   └─> app/(chat)/api/chat/route.ts
       ├─> Keep file parts as metadata (don't fetch content)
       └─> streamText() with file references only

3. LLM DECISION LAYER (MODIFIED)
   └─> AI Model receives file metadata
       ├─> System prompt: "When files attached, call createDocument with file URLs"
       └─> Calls createDocument with file URLs, not content

4. TOOL EXECUTION LAYER (MODIFIED)
   └─> lib/ai/tools/create-document.ts
       ├─> Receives files array with URLs
       ├─> Tool fetches and processes files as needed
       └─> Passes to appropriate handler

5. ARTIFACT GENERATION LAYER (MODIFIED)
   └─> artifacts/meeting-summary/server.ts
       ├─> Receives file URLs
       ├─> Fetches content directly
       └─> Single streamText() call for summary
```

### Key Changes

#### 1. Message Processing (file-processor.ts)
**Current**: Fetches file content and embeds in message
**Proposed**: Preserve file metadata, add reference instruction

```typescript
// Instead of fetching and embedding content:
export async function processMessageFiles(messages: ChatMessage[]): Promise<ChatMessage[]> {
  return messages.map(message => {
    if (message.role !== 'user') return message;
    
    const fileParts = message.parts?.filter(p => p.type === 'file') || [];
    const textParts = message.parts?.filter(p => p.type === 'text') || [];
    
    if (fileParts.length > 0) {
      // Add instruction about files without fetching content
      const fileReferences = fileParts.map(f => 
        `[Attached: ${f.name} (${f.mediaType})]`
      ).join('\n');
      
      const enhancedText = textParts[0]?.text 
        ? `${textParts[0].text}\n\n${fileReferences}`
        : fileReferences;
      
      return {
        ...message,
        parts: [
          { type: 'text', text: enhancedText },
          ...fileParts // Keep file parts for tool access
        ]
      };
    }
    
    return message;
  });
}
```

#### 2. Tool Schema Enhancement (create-document.ts)
**Current**: Receives content as string
**Proposed**: Add fileUrl parameter for LLM to pass file URLs

```typescript
const createDocumentSchema = z.object({
  title: z.string(),
  kind: z.enum(['text', 'code', 'sheet']),
  documentType: z.enum(['general', 'meeting-summary', 'report', 'action-items']).optional(),
  fileUrl: z.string().url().optional().describe('URL of uploaded file to process'),
  content: z.string().optional().describe('Direct text content or pasted transcript'),
  metadata: z.object({
    meetingDate: z.string().optional(),
    participants: z.array(z.string()).optional(),
  }).optional(),
});
```

**Key Insight**: The LLM will extract the URL from the file parts in the message and pass it as the `fileUrl` parameter. This avoids needing complex file array handling.

#### 3. Tool Execution Logic (create-document.ts)
**Current**: Passes content directly
**Proposed**: Fetches content from URL when provided

```typescript
execute: async ({ title, kind, documentType, fileUrl, content, metadata }) => {
  let processedContent = content;
  
  // If fileUrl provided and no direct content, fetch the file
  if (!processedContent && fileUrl) {
    try {
      console.log(`[CreateDocument] Fetching file from: ${fileUrl}`);
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      processedContent = await response.text();
      console.log(`[CreateDocument] Fetched ${processedContent.length} chars`);
    } catch (error) {
      console.error('[CreateDocument] File fetch failed:', error);
      throw new Error(`Could not retrieve file from ${fileUrl}`);
    }
  }
  
  // Pass normalized content to handler
  if (documentType === 'meeting-summary') {
    await meetingSummaryHandler.onCreateDocument({
      id,
      title,
      dataStream,
      session,
      metadata: {
        transcript: processedContent, // Always a string
        meetingDate: metadata?.meetingDate,
        participants: metadata?.participants,
      }
    });
  }
}
```

#### 4. System Prompt Updates (prompts.ts)
**Current**: Instructs to process file content in message
**Proposed**: Instructs to extract URLs and pass to tools

```typescript
export const meetingIntelligencePrompt = `
## File Attachment Handling

When you see file attachments in a message:
1. File attachments appear as [Attached: filename] in the text
2. The actual file data is in the message parts array as type:'file' with a URL
3. Extract the URL from the file part
4. Call createDocument with:
   - fileUrl: the URL from the file part
   - documentType: "meeting-summary" for transcripts
   - title: from filename or user instruction

Example: If you see message parts like:
- Text: "Summarize this [Attached: meeting.txt]"  
- File part: { type: 'file', url: 'https://blob.vercel-storage.com/abc123', filename: 'meeting.txt' }

Call createDocument with:
- fileUrl: 'https://blob.vercel-storage.com/abc123'
- documentType: 'meeting-summary'
- title: 'Meeting Summary'

NEVER try to read file content directly - always pass the URL to the tool.
`;
```

### Message Format Examples

#### Current Format (with embedded content)
```json
{
  "role": "user",
  "parts": [
    {
      "type": "text",
      "text": "Summarize this transcript\n\nFile: meeting.txt\n----\nFileContents:\n[80,000 tokens of transcript]"
    }
  ]
}
```

#### Proposed Format (with file references)
```json
{
  "role": "user",
  "parts": [
    {
      "type": "text",
      "text": "Summarize this transcript\n\n[Attached: meeting.txt (text/plain)]"
    },
    {
      "type": "file",
      "url": "https://blob.vercel-storage.com/...",
      "name": "meeting.txt",
      "mediaType": "text/plain"
    }
  ]
}
```

## Implementation Plan

### Phase 1: Tool Enhancement
1. Update createDocument schema to accept files array
2. Add file fetching logic in createDocument tool
3. Update meeting-summary handler to work with fetched content

### Phase 2: Message Processing
1. Modify file-processor.ts to preserve file metadata
2. Update system prompts for file reference handling
3. Ensure file parts are passed through to tools

### Phase 3: Testing & Validation
1. Test file upload flow end-to-end
2. Verify token usage reduction
3. Ensure backward compatibility with direct content

### Phase 4: Future Optimizations (NOT for initial implementation)

**IMPORTANT**: These are future enhancements. DO NOT implement in the initial version.

#### 4.1 File Size Validation (Priority: High)
**When**: Before fetching in tool execute
**How**: 
```typescript
// Add HEAD request to check size before fetching
const headResponse = await fetch(fileUrl, { method: 'HEAD' });
const contentLength = headResponse.headers.get('content-length');
if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
  throw new Error(`File too large: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`);
}
```
**Why**: Prevents memory issues and token limit violations

#### 4.2 Streaming for Large Files (Priority: Medium)
**When**: Files > 1MB
**How**: 
```typescript
// DO NOT implement initially - requires careful chunking logic
// Future: Use streams API to process in chunks
// Considerations: How to summarize chunks, maintain context
```
**Why**: Memory efficiency for large transcripts

#### 4.3 Simple Progress Feedback (Priority: Low)
**When**: During file fetch
**How**:
```typescript
// Simple approach - just log to dataStream
dataStream.write({
  type: 'data-appendMessage',
  data: 'Fetching transcript file...',
  transient: true,
});
```
**Why**: User feedback for slow fetches

#### 4.4 What NOT to Do
- ❌ NO caching between requests (stateless tool execution)
- ❌ NO complex retry logic (fail fast is better)
- ❌ NO parallel file fetching (keep it simple)
- ❌ NO file type detection beyond MIME type checking

## Validation Strategy

### Manual Testing Steps
1. **Upload Small File**: Verify tool receives file reference
2. **Upload Large File**: Confirm no timeout, proper streaming
3. **Multiple Files**: Test handling of multiple attachments
4. **Error Cases**: Test network failures, invalid files

### Logging Points
```typescript
// Key logging locations:
1. file-processor.ts: Log when preserving file metadata
2. route.ts: Log message structure before streamText
3. create-document.ts: Log when fetching files
4. meeting-summary/server.ts: Log content source (fetched vs provided)
```

### Success Metrics
1. Token usage reduced by >90% for file uploads
2. No increase in latency for summary generation
3. Support for files >100k tokens
4. Maintain backward compatibility

## Risk Assessment

### Potential Issues
1. **Network Failures**: File fetch could fail in tool
   - Mitigation: Add retry logic, proper error messages
   
2. **Large Files**: Memory issues when fetching
   - Mitigation: Stream processing, size limits
   
3. **Tool Confusion**: AI might not pass files correctly
   - Mitigation: Clear prompts, examples in system prompt

### Rollback Plan
1. Feature flag for new behavior
2. Keep old file-processor logic available
3. Monitor error rates, switch back if needed

## How the Solution Works

### The Core Challenge
Tools only receive their Zod-defined parameters, not the original message parts. The file URL exists in the message's file parts, but tools can't directly access it.

### The Solution: LLM as Data Extractor
Modern LLMs are excellent at extracting structured data from their input. We leverage this capability:

1. **Message contains file parts**: `{ type: 'file', url: '...', filename: '...', mediaType: '...' }`
2. **LLM sees the file reference**: Via the text "[Attached: filename]" 
3. **LLM extracts the URL**: From the file part structure
4. **LLM passes URL to tool**: Via the `fileUrl` parameter in the tool call

### Why This Works
- LLMs can reliably extract URLs from structured JSON-like data
- The file part structure is consistent and predictable
- Clear prompt instructions guide the extraction
- Single URL parameter is simpler than complex file arrays

### 4. Message Parts Structure

**AI SDK FileUIPart Structure** (actual from node_modules/ai):
```typescript
type FileUIPart = {
  type: 'file',
  url: string,         // URL to the file
  mediaType: string,   // Required MIME type
  filename?: string    // Optional filename
}
```

**Our Current Implementation** (from multimodal-input.tsx):
```typescript
parts: [
  {
    type: 'file',
    url: attachment.url,      // ✅ Correct property name
    name: attachment.name,    // ❌ Should be 'filename'
    mediaType: attachment.contentType, // ✅ Correct
  },
  {
    type: 'text',
    text: input,  // User's typed message
  }
]
```

**Issue Found**: We're using `name` instead of `filename`

### 5. File Processor Behavior Change
**Current**: Downloads file, embeds content in text part
**Proposed**: Preserves file parts, adds reference text like "[Attached: filename]"

## AI SDK Type Usage Locations

### Understanding FilePart vs FileUIPart

The AI SDK has two different file part types:

1. **FileUIPart** - For UI/chat messages (what we use in our components)
   ```typescript
   type FileUIPart = {
     type: 'file';
     url: string;         // Always a URL for UI
     filename?: string;
     mediaType: string;
   }
   ```

2. **FilePart** - For model messages (what gets sent to the LLM)
   ```typescript
   interface FilePart {
     type: 'file';
     data: DataContent | URL;  // Can be various formats
     filename?: string;
     mediaType: string;
   }
   ```

**Key Point**: We use `FileUIPart` in our code. The SDK's `convertToModelMessages()` automatically converts `FileUIPart` → `FilePart`.

### Where to Import and Use AI SDK Types

| File | Current Types | Replace With | Import Statement | Why This Type |
|------|--------------|--------------|------------------|---------------|
| `lib/ai/utils/file-processor.ts` | Custom `FilePart`, `TextPart` interfaces | `FileUIPart`, `TextUIPart` | `import type { FileUIPart, TextUIPart } from 'ai'` | Processing UI messages |
| `components/multimodal-input.tsx` | Plain object with `name` property | Object matching `FileUIPart` shape | `import type { FileUIPart, TextUIPart } from 'ai'` | Creating UI messages |
| `lib/types.ts` | Already uses `UIMessage` | Keep as-is | Already imports from 'ai' | Already correct |

### Type Assertions for Safety

```typescript
// In multimodal-input.tsx, add type assertion:
parts: [
  ...attachments.map((attachment) => ({
    type: 'file' as const,
    url: attachment.url,
    filename: attachment.name,  // Fixed property name
    mediaType: attachment.contentType,
  } satisfies FileUIPart)),  // Type assertion
  {
    type: 'text' as const,
    text: input,
  } satisfies TextUIPart,  // Type assertion
]
```

## Implementation Steps

### Step 1: Fix Type Compliance
```typescript
// multimodal-input.tsx line 132
// BEFORE:
name: attachment.name,
// AFTER:  
filename: attachment.name,
```

### Step 2: Update File Processor to Use AI SDK Types
```typescript
// file-processor.ts

// REMOVE these custom interfaces (lines 3-15):
interface FilePart {
  type: 'file';
  mediaType: string;
  url: string;
  name: string;  // Wrong property name
}
interface TextPart {
  type: 'text';
  text: string;
}

// REPLACE with AI SDK imports:
import type { FileUIPart, TextUIPart } from 'ai';

// Update function signature:
export async function processMessageFiles(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  // Use FileUIPart and TextUIPart types
  const fileParts = message.parts?.filter(
    (p): p is FileUIPart => p.type === 'file'
  );
  const textParts = message.parts?.filter(
    (p): p is TextUIPart => p.type === 'text'
  );
}
```

### Step 3: Update Tool Schema
```typescript
// create-document.ts
const createDocumentSchema = z.object({
  // ... existing fields ...
  fileUrl: z.string().url().optional(),
  content: z.string().optional(),
});
```

### Step 4: Add File Fetching to Tool
```typescript
// create-document.ts execute function
if (!processedContent && fileUrl) {
  const response = await fetch(fileUrl);
  processedContent = await response.text();
}
```

### Step 5: Update System Prompts
```typescript
// prompts.ts
// Add instructions for extracting and passing file URLs
```

## Final Architecture Decisions

### 1. **Tool Parameter Strategy**: LLM Extracts and Passes URLs
```typescript
const createDocumentSchema = z.object({
  title: z.string(),
  kind: z.enum(['text', 'code', 'sheet']),
  documentType: z.enum(['general', 'meeting-summary', 'report', 'action-items']).optional(),
  fileUrl: z.string().url().optional().describe('URL of uploaded file to process'),
  content: z.string().optional().describe('Direct text content if pasted by user'),
  metadata: z.object({
    meetingDate: z.string().optional(),
    participants: z.array(z.string()).optional(),
  }).optional(),
});
```
The LLM will extract URLs from file parts and pass them explicitly.

### 2. **File Fetching Location**: Tool's Execute Function
- Tool fetches content when `fileUrl` is provided
- Tool passes normalized content to handlers
- Handlers always receive ready-to-use strings

### 3. **Type Compliance**: Use AI SDK Types
- Replace custom interfaces with `FileUIPart`, `TextUIPart` from 'ai'
- Fix `name` → `filename` in multimodal-input.tsx
- Import and use SDK types throughout

### 4. **Error Recovery**: Fail Fast with Clear Messages
- If fetch fails, throw with descriptive error
- User sees clear failure reason
- No silent failures or empty content

### 5. **File Type Support**: 
- text/plain ✅
- text/vtt ✅  
- application/pdf ✅ (requires text extraction)
- Future: any text-extractable format