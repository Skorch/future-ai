'use client';

import { useRouter } from 'next/navigation';
import { PlaybookTable } from '@/components/admin/playbook-table';
import type { Playbook } from '@/lib/db/schema';

interface PlaybookRow extends Playbook {
  stepCount: number;
}

export function PlaybookTableClient({
  playbooks,
}: {
  playbooks: PlaybookRow[];
}) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh();
  };

  return <PlaybookTable playbooks={playbooks} onUpdate={handleUpdate} />;
}
