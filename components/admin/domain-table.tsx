'use client';

import type { DomainWithRelations } from '@/lib/db/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface DomainTableProps {
  domains: DomainWithRelations[];
}

export function DomainTable({ domains }: DomainTableProps) {
  const router = useRouter();

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const countArtifactTypes = (domain: DomainWithRelations) => {
    // Domain has 5 artifact type references:
    // defaultObjectiveArtifactTypeId, defaultSummaryArtifactTypeId,
    // defaultObjectiveActionsArtifactTypeId, defaultWorkspaceContextArtifactTypeId,
    // defaultObjectiveContextArtifactTypeId
    return 5;
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Description
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Artifact Types
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => (
            <tr
              key={domain.id}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <Button
                  variant="link"
                  className="h-auto p-0 text-left font-medium justify-start"
                  onClick={() =>
                    router.push(`/admin/domains/${domain.id}/edit`)
                  }
                >
                  {domain.title}
                </Button>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                {truncateText(domain.description, 100)}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{countArtifactTypes(domain)}</Badge>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(domain.updatedAt), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-4 py-3">
                <Link href={`/admin/domains/${domain.id}/edit`}>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
