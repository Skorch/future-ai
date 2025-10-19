import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAllDomains } from '@/lib/db/queries/domain';
import { getAllArtifactTypes } from '@/lib/db/queries/artifact-type';
import { getUserById } from '@/lib/db/queries';
import { PromptsPageClient } from './_components/prompts-page-client';

export const metadata = {
  title: 'Prompt Management | Admin',
  description: 'Manage AI prompts for different scenarios',
};

export default async function AdminPromptsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  // Fetch all data needed for prompt editing
  const [domains, artifactTypes, user] = await Promise.all([
    getAllDomains(),
    getAllArtifactTypes(),
    getUserById(userId),
  ]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Prompt Management</h1>
        <p className="text-muted-foreground">
          Edit AI prompts for different scenarios. Changes are saved
          automatically and apply immediately.
        </p>
      </div>

      <PromptsPageClient
        domains={domains}
        artifactTypes={artifactTypes}
        user={user}
      />
    </div>
  );
}
