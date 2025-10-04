import { getPlaybookWithSteps } from '@/lib/db/queries/playbooks';
import { PlaybookForm } from '@/components/admin/playbook-form';
import { notFound } from 'next/navigation';

interface EditPlaybookPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditPlaybookPage({
  params,
}: EditPlaybookPageProps) {
  const { id } = await params;
  const playbook = await getPlaybookWithSteps(id);

  if (!playbook) {
    notFound();
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        Edit Playbook: {playbook.name}
      </h2>
      <PlaybookForm playbook={playbook} />
    </div>
  );
}
