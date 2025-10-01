import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Artifact Server Handlers', () => {
  describe('File Structure Verification', () => {
    it('text type should have all required files', () => {
      const basePath = join(process.cwd(), 'lib/artifacts/document-types/text');

      expect(existsSync(join(basePath, 'index.ts'))).toBe(true);
      expect(existsSync(join(basePath, 'metadata.ts'))).toBe(true);
      expect(existsSync(join(basePath, 'server.ts'))).toBe(true);
      expect(existsSync(join(basePath, 'client.tsx'))).toBe(true);
    });

    it('meeting-analysis type should have all required files', () => {
      const basePath = join(
        process.cwd(),
        'lib/artifacts/document-types/meeting-analysis',
      );

      expect(existsSync(join(basePath, 'index.ts'))).toBe(true);
      expect(existsSync(join(basePath, 'metadata.ts'))).toBe(true);
      expect(existsSync(join(basePath, 'server.ts'))).toBe(true);
      expect(existsSync(join(basePath, 'prompts.ts'))).toBe(true);
    });

    it('server.ts should NOT have hardcoded documentHandlersByArtifactKind array', () => {
      const serverPath = join(process.cwd(), 'lib/artifacts/server.ts');
      const content = readFileSync(serverPath, 'utf-8');

      // Verify the hardcoded array has been removed per spec
      expect(content).not.toContain(
        'export const documentHandlersByArtifactKind: Array<DocumentHandler> = [',
      );

      // Should NOT import handlers directly
      expect(content).not.toContain("from './document-types/text/server'");
      expect(content).not.toContain(
        "from './document-types/meeting-analysis/server'",
      );

      // Should NOT import from old locations
      expect(content).not.toContain("from '@/artifacts/text");
      expect(content).not.toContain("from '@/artifacts/meeting-summary");
    });
  });

  describe('Registry Integration', () => {
    it('handlers should be importable from new locations', async () => {
      // Verify the file structure is correct and imports work
      const textMetadata = await import(
        '@/lib/artifacts/document-types/text/metadata'
      );
      const meetingMetadata = await import(
        '@/lib/artifacts/document-types/meeting-analysis/metadata'
      );

      expect(textMetadata.metadata.type).toBe('text');
      expect(meetingMetadata.metadata.type).toBe('meeting-analysis');
    });
  });
});
