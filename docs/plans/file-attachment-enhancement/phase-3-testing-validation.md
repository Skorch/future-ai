# Phase 3: Testing & Validation

**Issue:** Enhanced File Attachment Support
**Phase:** 3 - Testing & Validation
**Status:** To Do
**Dependencies:** Phase 1 & Phase 2 completed

## Goal
Thoroughly test the file attachment enhancement end-to-end, verify token usage reduction, and ensure backward compatibility.

## Testing Scope
- End-to-end file upload flow
- Token usage measurement
- Backward compatibility
- Error handling
- Edge cases

## Test Scenarios

### 1. Basic File Upload Test

#### Setup
1. Start dev server: `pnpm dev`
2. Open browser console to monitor logs
3. Navigate to chat interface

#### Test Steps
```
1. Click paperclip icon to attach file
2. Select a .txt transcript file (< 1MB)
3. Type: "Summarize this meeting"
4. Send message
```

#### Expected Results
```
Browser Console:
✓ File upload successful to /api/files/upload
✓ Message sent with file part

Server Console:
✓ [FileProcessor] Found 1 file attachments
✓ [FileProcessor] Preserving file metadata
✓ NO "Fetching text file" or "Extracted X chars" messages
✓ [ChatRoute] Processing message { hasFileParts: true }
✓ [CreateDocument] Tool executed { hasFileUrl: true, hasContent: false }
✓ [CreateDocument] Fetching file from: https://...
✓ [CreateDocument] Fetched XXXX chars
✓ [MeetingSummaryHandler] Starting document creation
✓ Meeting summary generated and displayed
```

### 2. Token Usage Verification

#### Setup
```typescript
// Temporarily add to route.ts for testing
console.log('[ChatRoute] Token Usage Test', {
  messageLength: JSON.stringify(processedMessages).length,
  lastMessageLength: JSON.stringify(processedMessages[processedMessages.length - 1]).length,
});
```

#### Comparison Test
1. **Old Behavior** (revert file-processor.ts temporarily):
   - Upload 50KB transcript
   - Log: `messageLength: ~50000+ chars`

2. **New Behavior** (with changes):
   - Upload same 50KB transcript
   - Log: `messageLength: ~500 chars` (just metadata)

#### Success Metric
- Message size reduced by >90% for file uploads
- File content only fetched once (in tool)

### 3. Backward Compatibility Tests

#### Test 3.1: Direct Content Parameter
```
1. Open chat
2. Type: "Create an essay about AI"
3. Send message
```

**Expected**: 
- Tool receives content in response (not fileUrl)
- Essay generated normally

#### Test 3.2: Pasted Transcript
```
1. Open chat
2. Paste a meeting transcript directly (no file)
3. Type: "Summarize this: [pasted text]"
4. Send message
```

**Expected**:
- Tool receives content parameter with pasted text
- No fileUrl parameter
- Summary generated from pasted content

#### Test 3.3: Mixed Usage
```
1. Start chat with file upload → summary created
2. Follow up with: "Make it more concise"
3. Agent should modify existing summary
```

**Expected**:
- Conversation continues normally
- No re-fetching of original file

### 4. Error Handling Tests

#### Test 4.1: Invalid File URL
```typescript
// Temporarily modify route.ts to test
// Force an invalid URL in tool call
```

**Expected Error**:
```
[CreateDocument] File fetch failed: Error
"Could not retrieve file from [url]: Failed to fetch"
```

#### Test 4.2: Network Failure
```
1. Upload file successfully
2. Use browser dev tools to block network
3. Send message
```

**Expected**:
- Clear error message to user
- No crash or hang

#### Test 4.3: Missing Parameters
```
// Test tool with neither fileUrl nor content
```

**Expected**:
- Error: "No content provided: either fileUrl or content parameter is required"

### 5. Edge Cases

#### Test 5.1: Large File (5MB+)
```
1. Upload large transcript file
2. Monitor memory usage
3. Check for timeouts
```

**Current Behavior**: Should work but may be slow
**Future**: Phase 4 will add size validation

#### Test 5.2: Multiple Files
```
1. Attach 2 transcript files
2. Type: "Summarize both meetings"
```

**Expected**:
- LLM sees both files
- Currently: Processes first text file found
- Future: Could handle multiple files

#### Test 5.3: Non-Text Files
```
1. Upload an image file
2. Type: "Describe this image"
```

**Expected**:
- Image parts preserved
- Handled by different code path (not createDocument)

### 6. LLM Behavior Validation

#### Test 6.1: Prompt Following
Monitor that LLM:
1. Immediately calls createDocument for file attachments
2. Extracts correct URL from file part
3. Passes fileUrl parameter (not content)
4. Uses correct documentType

#### Test 6.2: Different Models
Test with different models if available:
- GPT-4
- Claude
- Local models

Verify consistent behavior across models.

## Performance Metrics

### Measure Before/After
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Message size (50KB file) | ~50KB | <1KB | >90% reduction |
| Time to first token | Baseline | Same or better | No regression |
| Memory usage | Baseline | Lower | Reduced |
| Token consumption | High | Low | >90% reduction |

## Logging Checklist

### Required Logs to Verify
- [ ] `[FileProcessor] Preserving file metadata` (not fetching)
- [ ] `[CreateDocument] Fetching file from: URL`
- [ ] `[CreateDocument] Fetched X chars`
- [ ] `[MeetingSummaryHandler] Starting document creation`

### Logs That Should NOT Appear
- [ ] ❌ `[FileProcessor] Fetching text file`
- [ ] ❌ `[FileProcessor] Extracted X chars from file`
- [ ] ❌ File content in streamText messages

## Manual Test Execution Plan

### Phase 3.1: Developer Testing
1. [ ] Run all test scenarios locally
2. [ ] Document any issues found
3. [ ] Verify all success criteria met

### Phase 3.2: Integration Testing
1. [ ] Test with real meeting transcripts
2. [ ] Test with various file sizes
3. [ ] Test error recovery

### Phase 3.3: User Acceptance
1. [ ] Deploy to staging (if available)
2. [ ] Test with realistic usage patterns
3. [ ] Gather feedback on performance

## Rollback Plan

If critical issues found:
1. **Revert file-processor.ts** to fetch content (old behavior)
2. **Keep tool changes** (backward compatible)
3. **Document issues** for future iteration

## Success Criteria

### Must Have
- [ ] File uploads work end-to-end
- [ ] Token usage reduced by >90%
- [ ] Backward compatibility maintained
- [ ] Clear error messages
- [ ] No TypeScript errors

### Should Have
- [ ] Performance same or better
- [ ] Works with all supported file types
- [ ] Handles edge cases gracefully

### Nice to Have
- [ ] Progress indicators (Phase 4)
- [ ] File size validation (Phase 4)
- [ ] Multiple file handling

## Sign-off Checklist

- [ ] All test scenarios pass
- [ ] Performance metrics meet targets
- [ ] No regressions identified
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Ready for production

## Notes
- Focus on functional testing first
- Performance optimization comes in Phase 4
- Document any limitations discovered
- Keep test files for regression testing