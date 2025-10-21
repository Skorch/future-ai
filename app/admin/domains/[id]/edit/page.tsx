import { getDomainWithRelations } from '@/lib/db/queries/admin/domain';
import { getAllArtifactTypes } from '@/lib/db/queries/artifact-type';
import { DomainForm } from '@/components/admin/domain-form';
import { notFound } from 'next/navigation';

interface EditDomainPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditDomainPage({ params }: EditDomainPageProps) {
  const { id } = await params;
  const [domain, artifactTypes] = await Promise.all([
    getDomainWithRelations(id),
    getAllArtifactTypes(),
  ]);

  if (!domain) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Domain</h1>
        <p className="text-muted-foreground mt-2">
          Update domain configuration and artifact type defaults
        </p>
      </div>

      <DomainForm domain={domain} artifactTypes={artifactTypes} />
    </div>
  );
}
