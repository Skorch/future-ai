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
      </div>
    </div>
  );
}
