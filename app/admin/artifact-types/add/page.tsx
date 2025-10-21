import { ArtifactTypeForm } from '@/components/admin/artifact-type-form';

export default async function AddArtifactTypePage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Artifact Type</h1>
        <p className="text-muted-foreground mt-2">
          Configure a new artifact type with AI instructions and templates
        </p>
      </div>

      <ArtifactTypeForm mode="create" />
    </div>
  );
}
