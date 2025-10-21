'use client';

import type { ArtifactType } from '@/lib/db/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface ArtifactTypeTableProps {
  artifactTypes: ArtifactType[];
}

export function ArtifactTypeTable({ artifactTypes }: ArtifactTypeTableProps) {
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const getCategoryBadge = (category: ArtifactType['category']) => {
    const variants = {
      objective: 'bg-blue-500/10 text-blue-700 border-blue-200',
      summary: 'bg-green-500/10 text-green-700 border-green-200',
      objectiveActions: 'bg-purple-500/10 text-purple-700 border-purple-200',
      context: 'bg-orange-500/10 text-orange-700 border-orange-200',
    };

    const labels = {
      objective: 'Objective',
      summary: 'Summary',
      objectiveActions: 'Actions',
      context: 'Context',
    };

    return (
      <Badge variant="outline" className={variants[category]}>
        {labels[category]}
      </Badge>
    );
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Category
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">
              Description
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {artifactTypes.map((artifactType) => (
            <tr
              key={artifactType.id}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3 font-medium">{artifactType.title}</td>
              <td className="px-4 py-3">
                {getCategoryBadge(artifactType.category)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                {truncateText(artifactType.description, 100)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(artifactType.updatedAt), {
                  addSuffix: true,
                })}
              </td>
              <td className="px-4 py-3">
                <Link href={`/admin/artifact-types/${artifactType.id}/edit`}>
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
