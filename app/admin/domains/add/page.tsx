import { getAllArtifactTypes } from '@/lib/db/queries/artifact-type';
import { DomainForm } from '@/components/admin/domain-form';

export default async function AddDomainPage() {
  const artifactTypes = await getAllArtifactTypes();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Domain</h1>
        <p className="text-muted-foreground mt-2">
          Add a new business intelligence domain with default artifact type
          configurations
        </p>
      </div>

      <DomainForm artifactTypes={artifactTypes} />
    </div>
  );
}
