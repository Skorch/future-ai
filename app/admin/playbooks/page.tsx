import {
  getPlaybookWithSteps,
  getAllPlaybooks,
} from '@/lib/db/queries/playbooks';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaybookTableClient } from './playbook-table-client';

export default async function PlaybooksPage() {
  const playbooks = await getAllPlaybooks();

  // Fetch full playbooks with step counts
  const playbooksWithSteps = await Promise.all(
    playbooks.map(async (meta) => {
      const full = await getPlaybookWithSteps(meta.id);
      if (!full) {
        return null;
      }
      return {
        ...full,
        stepCount: full.steps.length,
      };
    }),
  ).then((results) => results.filter((p) => p !== null));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Playbooks</h2>
        <Link href="/admin/playbooks/new">
          <Button>+ New Playbook</Button>
        </Link>
      </div>

      {playbooksWithSteps.length === 0 ? (
        <div className="text-center py-12 border rounded-md">
          <p className="text-muted-foreground mb-4">No playbooks yet</p>
          <Link href="/admin/playbooks/new">
            <Button>Create your first playbook</Button>
          </Link>
        </div>
      ) : (
        <PlaybookTableClient playbooks={playbooksWithSteps} />
      )}
    </div>
  );
}
