import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Admin Portal</h2>
        <p className="text-muted-foreground">
          Manage playbooks, debug prompts, and configure the AI assistant.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Playbooks Card */}
        <div className="border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold">Playbooks</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage workflow playbooks that guide the AI through
            structured tasks like BANT validation and initiative tracking.
          </p>
          <Link href="/admin/playbooks">
            <Button variant="outline" className="w-full">
              Manage Playbooks
            </Button>
          </Link>
        </div>

        {/* Prompts Card */}
        <div className="border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold">Prompts</h3>
          <p className="text-sm text-muted-foreground">
            Edit AI prompts for different scenarios. Changes are saved
            automatically and apply immediately.
          </p>
          <Link href="/admin/prompts">
            <Button variant="outline" className="w-full">
              Manage Prompts
            </Button>
          </Link>
        </div>

        {/* Domains Card */}
        <div className="border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold">Domains</h3>
          <p className="text-sm text-muted-foreground">
            Configure domain-specific settings and default artifact types for
            different business contexts.
          </p>
          <Link href="/admin/domains">
            <Button variant="outline" className="w-full">
              Manage Domains
            </Button>
          </Link>
        </div>

        {/* Artifact Types Card */}
        <div className="border rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold">Artifact Types</h3>
          <p className="text-sm text-muted-foreground">
            Configure AI instruction prompts and document templates for each
            artifact category.
          </p>
          <Link href="/admin/artifact-types">
            <Button variant="outline" className="w-full">
              Manage Artifact Types
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
