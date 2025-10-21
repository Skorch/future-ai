import { notFound } from 'next/navigation';
import { getArtifactTypeById } from '@/lib/db/queries/artifact-type';
import { ArtifactTypeForm } from '@/components/admin/artifact-type-form';

interface EditArtifactTypePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditArtifactTypePage({
  params,
}: EditArtifactTypePageProps) {
  const { id } = await params;
  const artifactType = await getArtifactTypeById(id);

  if (!artifactType) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Artifact Type</h1>
        <p className="text-muted-foreground mt-2">
          Update AI instructions and templates for {artifactType.title}
        </p>
      </div>

      <ArtifactTypeForm artifactType={artifactType} mode="edit" />
    </div>
  );
}
