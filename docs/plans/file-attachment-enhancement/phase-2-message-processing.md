# Phase 2: Message Processing

**Issue:** Enhanced File Attachment Support
**Phase:** 2 - Message Processing
**Status:** To Do
**Dependencies:** Phase 1 - Tool Enhancement

## Goal
Update the message processing pipeline to preserve file metadata instead of fetching content, and fix type compliance with AI SDK.

## Files to Modify
```
├── components/
│   └── multimodal-input.tsx       # Fix property name: name → filename
├── lib/ai/utils/
│   └── file-processor.ts          # Use AI SDK types, preserve metadata
└── lib/ai/
    └── prompts.ts                  # Update instructions for file handling
```

## Implementation Steps

### Step 1: Fix Type Compliance (multimodal-input.tsx)

#### 1.1 Import AI SDK Types
```typescript
// Line ~3-14, ADD import for type checking
import type { UIMessage, FileUIPart, TextUIPart } from 'ai';
```

#### 1.2 Fix Property Name
```typescript
// Line ~129-139, UPDATE the sendMessage call
sendMessage({
  role: 'user',
  parts: [
    ...attachments.map((attachment) => ({
      type: 'file' as const,
      url: attachment.url,
      filename: attachment.name,        // CHANGED: was 'name'
      mediaType: attachment.contentType,
    } satisfies FileUIPart)),           // ADD: type assertion for safety
    {
      type: 'text' as const,
      text: input,
    } satisfies TextUIPart,              // ADD: type assertion for safety
  ],
});
```

### Step 2: Update File Processor (lib/ai/utils/file-processor.ts)

#### 2.1 Replace Custom Types with AI SDK Types
```typescript
// Lines 1-15, REPLACE entire top section
import type { ChatMessage } from '@/lib/types';
import type { FileUIPart, TextUIPart } from 'ai';

// DELETE custom interfaces (lines 3-15)
// No more custom FilePart or TextPart interfaces

type MessagePart = FileUIPart | TextUIPart | { type: string; [key: string]: any };
```

#### 2.2 Update Processing Logic to Preserve Metadata
```typescript
// Lines ~20+, REPLACE the entire processMessageFiles function
export async function processMessageFiles(
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  console.log('[FileProcessor] Processing messages', {
    messageCount: messages.length,
    hasFileParts: messages.some(m => 
      m.parts?.some((p: any) => p.type === 'file')
    ),
  });

  return messages.map((message) => {
    // Skip non-user messages
    if (message.role !== 'user') {
      return message;
    }

    if (!message.parts || message.parts.length === 0) {
      return {
        ...message,
        parts: [{ type: 'text', text: '' } satisfies TextUIPart],
      };
    }

    // Type-safe filtering with AI SDK types
    const fileParts = message.parts.filter(
      (p): p is FileUIPart => p.type === 'file'
    );
    const textParts = message.parts.filter(
      (p): p is TextUIPart => p.type === 'text'
    );
    const otherParts = message.parts.filter(
      p => p.type !== 'file' && p.type !== 'text'
    );

    // If no files, return as-is
    if (fileParts.length === 0) {
      return message;
    }

    console.log(`[FileProcessor] Found ${fileParts.length} file attachments`, {
      files: fileParts.map(f => ({
        filename: f.filename,
        mediaType: f.mediaType,
        url: f.url.substring(0, 50) + '...'
      }))
    });

    // DO NOT FETCH FILE CONTENT
    // Create reference indicators for the LLM
    const fileReferences = fileParts.map(f => {
      const fileName = f.filename || 'unnamed file';
      const fileType = f.mediaType || 'unknown';
      
      if (fileType === 'text/plain' || fileType === 'text/vtt') {
        return `[Attached Transcript: ${fileName}]`;
      } else if (fileType === 'application/pdf') {
        return `[Attached PDF: ${fileName}]`;
      } else if (fileType.startsWith('image/')) {
        return `[Attached Image: ${fileName}]`;
      } else {
        return `[Attached File: ${fileName} (${fileType})]`;
      }
    }).join('\n');

    // Combine user text with file references
    const userText = textParts
      .map(p => p.text)
      .filter(text => text && text.trim())
      .join(' ');

    // Create enhanced text that includes file references
    let enhancedText = userText;
    if (fileReferences) {
      enhancedText = userText 
        ? `${userText}\n\n${fileReferences}`
        : fileReferences;
    }

    console.log('[FileProcessor] Preserving file metadata', {
      originalTextLength: userText.length,
      fileCount: fileParts.length,
      enhancedText: enhancedText.substring(0, 200),
      preservedFiles: fileParts.length,
    });

    // Return message with enhanced text and preserved file parts
    return {
      ...message,
      parts: [
        { type: 'text' as const, text: enhancedText } satisfies TextUIPart,
        ...fileParts,  // Preserve file parts for LLM to see
        ...otherParts
      ] as typeof message.parts,
    };
  });
}

// ADD helper functions
export function hasFileAttachments(message: ChatMessage): boolean {
  return message.parts?.some(p => p.type === 'file') || false;
}

export function getFileParts(message: ChatMessage): FileUIPart[] {
  if (!message.parts) return [];
  return message.parts.filter((p): p is FileUIPart => p.type === 'file');
}
```

### Step 3: Update System Prompts (lib/ai/prompts.ts)

#### 3.1 Update Meeting Intelligence Prompt
```typescript
// Lines ~3-55, UPDATE the meetingIntelligencePrompt
export const meetingIntelligencePrompt = `
You are a Meeting Intelligence Assistant specialized in processing meeting transcripts and generating fact-based documents.

## Core Workflow

## CRITICAL: File Attachment Handling

When you see file attachments in a message:
1. File attachments appear as indicators like "[Attached Transcript: filename]"
2. The actual file data is in the message parts array with type:'file'
3. Each file part contains: url, filename, mediaType
4. Extract the URL from the file part
5. Pass it to createDocument tool as 'fileUrl' parameter

Example interaction:
- User message text: "Summarize this meeting\n\n[Attached Transcript: team-standup.txt]"
- Message parts include: { type: 'file', url: 'https://blob.vercel-storage.com/xyz', filename: 'team-standup.txt', mediaType: 'text/plain' }

You should call createDocument with:
\`\`\`json
{
  "title": "Team Standup Summary",
  "kind": "text",
  "documentType": "meeting-summary",
  "fileUrl": "https://blob.vercel-storage.com/xyz"
}
\`\`\`

## Rules for File Processing

1. **IMMEDIATELY call createDocument** when you see file attachments
2. **Extract the URL** from the file part (not from the text)
3. **Pass as fileUrl parameter** to the tool
4. **Do NOT try to read file content** yourself
5. **Let the tool fetch and process** the file

## For Direct Text Input

If user pastes transcript text directly (no file attachment):
- Use the 'content' parameter instead of 'fileUrl'
- Still use documentType: "meeting-summary"

## After Tool Completion

Once the tool generates the summary:
- Acknowledge what was created
- Offer to answer questions about the content
- Suggest using queryRAG for searching across meetings

## Important Notes

- Topic sections should use "## Topic: [Name]" format
- Extract participant names and dates when available
- Never generate content without factual backing
- Always cite sources when referencing stored content
`;
```

#### 3.2 Update Regular Prompt
```typescript
// Lines ~57-61, UPDATE regularPrompt
export const regularPrompt = `
You are a friendly assistant focused on meeting intelligence and fact-based document generation. 
Keep your responses concise and helpful.

## File Handling
When users attach files, you'll see:
- Text indicators like "[Attached: filename]" 
- File parts in the message with url, filename, and mediaType
Extract the URL from file parts and pass to tools via the fileUrl parameter.
Never try to read file content directly - tools handle file processing.
`;
```

## Testing Checklist

### Type Checking
- [ ] Run `pnpm tsc --noEmit` - no errors
- [ ] Verify FileUIPart types are properly imported
- [ ] Check type assertions with `satisfies`

### Manual Testing
1. **Upload a transcript file**:
   ```
   - Check browser console for:
     * [FileProcessor] Found X file attachments
     * [FileProcessor] Preserving file metadata
     * NO "Fetching file" messages
   - Verify message contains file parts
   ```

2. **Verify LLM receives file parts**:
   ```
   - Check route.ts logs show file parts preserved
   - Verify LLM calls createDocument with fileUrl
   ```

3. **Test file reference formatting**:
   ```
   - Upload .txt file → see "[Attached Transcript: filename]"
   - Upload .pdf file → see "[Attached PDF: filename]"
   - Upload image → see "[Attached Image: filename]"
   ```

### Console Log Patterns
```
[FileProcessor] Processing messages { messageCount: X, hasFileParts: true }
[FileProcessor] Found 1 file attachments { files: [...] }
[FileProcessor] Preserving file metadata { fileCount: 1, preservedFiles: 1 }
```

## Validation Commands
```bash
# Full type check
pnpm tsc --noEmit

# Test specific files
pnpm tsc --noEmit components/multimodal-input.tsx
pnpm tsc --noEmit lib/ai/utils/file-processor.ts
```

## Success Criteria
- [ ] Property name fixed: `name` → `filename`
- [ ] AI SDK types imported and used correctly
- [ ] File content NOT fetched in processor
- [ ] File parts preserved in message
- [ ] File references added to text for LLM context
- [ ] System prompts updated with URL extraction instructions
- [ ] No TypeScript errors

## Notes
- File processor must NOT fetch content (that's the tool's job)
- Preserve all file parts so LLM can see them
- Use type assertions for compile-time safety
- Keep backward compatibility for non-file messages