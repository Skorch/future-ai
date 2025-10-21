import { getPlaybookWithDomains } from '@/lib/db/queries/admin/playbooks';
import { PlaybookForm } from '@/components/admin/playbook-form';
import { notFound } from 'next/navigation';
import { getDomainsForForm } from '../../actions';

interface EditPlaybookPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditPlaybookPage({
  params,
}: EditPlaybookPageProps) {
  const { id } = await params;
  const [playbook, domains] = await Promise.all([
    getPlaybookWithDomains(id),
    getDomainsForForm(),
  ]);

  if (!playbook) {
    notFound();
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">
        Edit Playbook: {playbook.name}
      </h2>
      <PlaybookForm playbook={playbook} domains={domains} />
    </div>
  );
}
