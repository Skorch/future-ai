import { getAllPlaybooksWithDomains } from '@/lib/db/queries/admin/playbooks';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaybookTableClient } from './playbook-table-client';

export default async function PlaybooksPage() {
  const playbooks = await getAllPlaybooksWithDomains();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Playbook Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage playbooks for guided workflows
          </p>
        </div>
        <Link href="/admin/playbooks/new">
          <Button>+ New Playbook</Button>
        </Link>
      </div>

      {playbooks.length === 0 ? (
        <div className="text-center py-12 border rounded-md">
          <p className="text-muted-foreground mb-4">No playbooks yet</p>
          <Link href="/admin/playbooks/new">
            <Button>Create your first playbook</Button>
          </Link>
        </div>
      ) : (
        <PlaybookTableClient playbooks={playbooks} />
      )}
    </div>
  );
}
