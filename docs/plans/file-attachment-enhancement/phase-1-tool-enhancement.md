# Phase 1: Tool Enhancement

**Issue:** Enhanced File Attachment Support
**Phase:** 1 - Tool Enhancement
**Status:** To Do
**Dependencies:** None

## Goal
Update the createDocument tool and meeting-summary handler to accept file URLs instead of embedded content, enabling lazy loading of file data.

## Files to Modify
```
├── lib/ai/tools/
│   └── create-document.ts         # Add fileUrl parameter, implement fetching
└── artifacts/meeting-summary/
    └── server.ts                   # Update to handle normalized transcript
```

## Implementation Steps

### Step 1: Update Tool Schema (create-document.ts)

#### 1.1 Update Zod Schema
```typescript
// Line ~17-33, UPDATE the schema to add fileUrl parameter
const createDocumentSchema = z.object({
  title: z.string(),
  kind: z.enum(artifactKinds),
  documentType: z
    .enum(['general', 'meeting-summary', 'report', 'action-items'])
    .optional()
    .default('general'),
  fileUrl: z.string().url().optional()
    .describe('URL of uploaded file to process (e.g., transcript)'),
  content: z.string().optional()
    .describe('Direct text content or pasted transcript'),
  metadata: z
    .object({
      isTranscriptSummary: z.boolean().optional(),
      transcriptUrl: z.string().optional(), // Remove - redundant with fileUrl
      meetingDate: z.string().optional(),
      participants: z.array(z.string()).optional(),
    })
    .optional(),
});
```

#### 1.2 Update Tool Description
```typescript
// Line ~37-38, UPDATE the description
description: `Create a document or process uploaded files. 
When user uploads a file (shown as [Attached: filename]):
- Extract the file URL from the message parts
- Pass it as 'fileUrl' parameter
- Use documentType:"meeting-summary" for transcripts
Tool will fetch and process the file content.
For direct text: use 'content' parameter instead.`,
```

#### 1.3 Update Execute Function
```typescript
// Line ~40+, UPDATE execute function signature and add fetching
execute: async ({ title, kind, documentType, fileUrl, content, metadata }) => {
  console.log('[CreateDocument] Tool executed', {
    title,
    kind,
    documentType,
    hasFileUrl: !!fileUrl,
    hasContent: !!content,
    contentLength: content?.length || 0,
  });

  const id = generateUUID();
  let processedContent = content;

  // Fetch file if URL provided and no direct content
  if (!processedContent && fileUrl) {
    try {
      console.log(`[CreateDocument] Fetching file from: ${fileUrl}`);
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      processedContent = await response.text();
      console.log(`[CreateDocument] Fetched ${processedContent.length} chars from ${fileUrl}`);
    } catch (error) {
      console.error('[CreateDocument] File fetch failed:', error);
      throw new Error(`Could not retrieve file from ${fileUrl}: ${error.message}`);
    }
  }

  // Validate we have content to process
  if (!processedContent) {
    throw new Error('No content provided: either fileUrl or content parameter is required');
  }

  // Remove old validation for meeting summaries (lines ~55-64)
  // The transcript validation was incorrect - we're processing raw transcript, not summary

  // ... rest of dataStream writes ...

  // Update handler invocation for meeting-summary
  if (documentType === 'meeting-summary') {
    console.log('[CreateDocument] Using meeting-summary handler');
    const { meetingSummaryHandler } = await import('@/artifacts/meeting-summary/server');

    await meetingSummaryHandler.onCreateDocument({
      id,
      title,
      dataStream,
      session,
      metadata: {
        transcript: processedContent, // Pass normalized content
        meetingDate: metadata?.meetingDate,
        participants: metadata?.participants,
        // Remove files passing - not needed in this phase
      },
    });
    console.log('[CreateDocument] Meeting summary handler completed');
  } else {
    // ... existing handler logic for other document types ...
  }
```

### Step 2: Update Meeting Summary Handler (artifacts/meeting-summary/server.ts)

#### 2.1 Simplify Handler Logic
```typescript
// Line ~6-20, the handler should expect transcript in metadata
onCreateDocument: async ({ title, dataStream, metadata }) => {
  console.log('[MeetingSummaryHandler] Starting document creation', {
    title,
    hasTranscript: !!metadata?.transcript,
    transcriptLength: metadata?.transcript?.length || 0,
    meetingDate: metadata?.meetingDate,
    participants: metadata?.participants,
  });

  let draftContent = '';

  // Extract transcript from metadata - it's already fetched by the tool
  const transcript = metadata?.transcript || '';
  
  if (!transcript) {
    console.error('[MeetingSummaryHandler] No transcript provided');
    throw new Error('Transcript is required for meeting summary generation');
  }

  const meetingDate = metadata?.meetingDate || new Date().toISOString().split('T')[0];
  const participants = metadata?.participants || [];

  console.log('[MeetingSummaryHandler] Preparing to stream with artifact-model', {
    transcriptLength: transcript.length,
    transcriptPreview: transcript.substring(0, 100),
  });

  // ... rest of streamText logic remains the same ...
```

## Testing Checklist

### Unit Testing
- [ ] Test tool with `fileUrl` parameter only
- [ ] Test tool with `content` parameter only  
- [ ] Test tool with both parameters (content should take precedence)
- [ ] Test tool with neither parameter (should error)
- [ ] Test file fetch failure handling
- [ ] Test invalid URL handling

### Manual Testing Steps
1. **Test with File Upload**:
   ```
   - Upload a .txt transcript file
   - Type "Summarize this meeting"
   - Verify logs show:
     * Tool receives fileUrl parameter
     * File fetch attempt and success
     * Content passed to handler
   ```

2. **Test with Pasted Content**:
   ```
   - Paste transcript text directly
   - Type "Create a meeting summary"
   - Verify tool uses content parameter (no fetch)
   ```

3. **Test Error Cases**:
   ```
   - Provide invalid fileUrl
   - Verify clear error message returned
   ```

### Console Log Verification
Look for these log patterns:
```
[CreateDocument] Tool executed { hasFileUrl: true, hasContent: false }
[CreateDocument] Fetching file from: https://...
[CreateDocument] Fetched XXXXX chars from https://...
[MeetingSummaryHandler] Starting document creation { hasTranscript: true, transcriptLength: XXXXX }
```

## Validation Commands
```bash
# TypeScript compilation
pnpm tsc --noEmit

# Check for type errors in modified files
pnpm tsc --noEmit lib/ai/tools/create-document.ts
pnpm tsc --noEmit artifacts/meeting-summary/server.ts
```

## Success Criteria
- [ ] Tool accepts and processes fileUrl parameter
- [ ] File content is fetched successfully  
- [ ] Handler receives normalized transcript string
- [ ] Backward compatibility maintained (content parameter still works)
- [ ] Clear error messages for fetch failures
- [ ] No TypeScript errors

## Notes
- DO NOT implement caching in this phase
- DO NOT add file size checks yet (Phase 4)
- DO NOT modify file-processor.ts yet (Phase 2)
- Keep changes minimal and focused on tool enhancement only