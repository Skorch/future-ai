'use client';

import { useRouter } from 'next/navigation';
import { PlaybookTable } from '@/components/admin/playbook-table';
import type { AdminPlaybook } from '@/lib/db/queries/admin/playbooks';

export function PlaybookTableClient({
  playbooks,
}: {
  playbooks: AdminPlaybook[];
}) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh();
  };

  return <PlaybookTable playbooks={playbooks} onUpdate={handleUpdate} />;
}
