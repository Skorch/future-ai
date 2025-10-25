import { useState, useEffect } from 'react';
import type { PlaybookMetadata } from '@/lib/db/schema';
import { getLogger } from '@/lib/logger';

const logger = getLogger('usePlaybookSelector');

export function usePlaybookSelector(workspaceId: string) {
  const [playbooks, setPlaybooks] = useState<PlaybookMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlaybooks() {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch playbooks directly from workspace endpoint
        const response = await fetch(`/api/workspace/${workspaceId}/playbooks`);

        if (!response.ok) {
          throw new Error(`Failed to fetch playbooks: ${response.status}`);
        }

        const data = await response.json();
        setPlaybooks(data.playbooks || []);
      } catch (error) {
        logger.error('Failed to load playbooks', error);
        setPlaybooks([]);
      } finally {
        setLoading(false);
      }
    }

    loadPlaybooks();
  }, [workspaceId]);

  return { playbooks, loading };
}
