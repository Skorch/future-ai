import { getAllDomainsWithRelations } from '@/lib/db/queries/admin/domain';
import { DomainTable } from '@/components/admin/domain-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function DomainsPage() {
  const domains = await getAllDomainsWithRelations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domain Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage domain configurations and default artifact types
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/domains/add">
            <Plus className="mr-2 size-4" />
            New Domain
          </Link>
        </Button>
      </div>

      <DomainTable domains={domains} />
    </div>
  );
}
