import { getAllArtifactTypes } from '@/lib/db/queries/artifact-type';
import { ArtifactTypeTable } from '@/components/admin/artifact-type-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function ArtifactTypesPage() {
  const artifactTypes = await getAllArtifactTypes();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Artifact Type Management</h1>
          <p className="text-muted-foreground mt-2">
            Configure AI instruction prompts and document templates for each
            artifact category
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/artifact-types/add">
            <Plus className="mr-2 size-4" />
            New Artifact Type
          </Link>
        </Button>
      </div>

      <ArtifactTypeTable artifactTypes={artifactTypes} />
    </div>
  );
}
