import { ArtifactCategory } from '@/lib/db/schema';

/**
 * Converts technical category names to user-friendly display names
 */
export function getCategoryDisplayName(category: string): string {
  const labels: Record<string, string> = {
    [ArtifactCategory.OBJECTIVE]: 'Objective',
    [ArtifactCategory.SUMMARY]: 'Summary',
    [ArtifactCategory.OBJECTIVE_ACTIONS]: 'Objective Actions',
    [ArtifactCategory.WORKSPACE_CONTEXT]: 'Workspace Context',
    [ArtifactCategory.OBJECTIVE_CONTEXT]: 'Objective Context',
  };
  return labels[category] || category;
}
