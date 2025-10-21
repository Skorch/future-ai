import { PlaybookForm } from '@/components/admin/playbook-form';
import { getDomainsForForm } from '../actions';

export default async function NewPlaybookPage() {
  const domains = await getDomainsForForm();

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Create New Playbook</h2>
      <PlaybookForm domains={domains} />
    </div>
  );
}
