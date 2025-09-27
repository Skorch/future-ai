'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface WelcomeErrorProps {
  message?: string;
  workspaceId: string;
}

export function WelcomeError({ message, workspaceId }: WelcomeErrorProps) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-50 p-3">
            <AlertTriangle className="size-8 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Demo Setup Incomplete</h2>
          <p className="text-muted-foreground">
            {message ||
              "We couldn't set up the demo content, but you can still explore the app with an empty workspace."}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p>You can:</p>
          <ul className="mt-2 text-left list-disc list-inside space-y-1">
            <li>Start fresh with an empty workspace</li>
            <li>Create your own chats and upload documents</li>
            <li>Return to this page later to try again</li>
          </ul>
        </div>

        <Button asChild size="lg" className="w-full">
          <Link href={`/workspace/${workspaceId}`}>Continue to Workspace</Link>
        </Button>
      </div>
    </div>
  );
}
