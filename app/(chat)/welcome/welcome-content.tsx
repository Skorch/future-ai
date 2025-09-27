'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MessageSquare, FileText, Sparkles } from 'lucide-react';

interface WelcomeContentProps {
  workspaceId: string;
  isNewWorkspace: boolean;
  userName?: string;
}

export function WelcomeContent({
  workspaceId,
  isNewWorkspace,
  userName,
}: WelcomeContentProps) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold">
          Welcome{userName ? `, ${userName}` : ''} to AI Chatbot
        </h1>

        {isNewWorkspace ? (
          <>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  Your Demo Workspace is Ready!
                </h2>
                <Sparkles className="size-5 text-primary" />
              </div>
              <p className="text-muted-foreground">
                We&apos;ve created a Demo workspace with sample chats and
                documents to help you explore the AI assistant&apos;s
                capabilities.
              </p>
              <div className="text-left space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <MessageSquare className="size-4 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Example Conversations</div>
                    <div className="text-muted-foreground">
                      Browse pre-loaded chats to see how the AI responds to
                      various queries
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="size-4 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Sample Documents</div>
                    <div className="text-muted-foreground">
                      Explore document analysis with RAG-powered search
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-4 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Full Access</div>
                    <div className="text-muted-foreground">
                      Edit, delete, or build upon the demo content as you wish
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This is your personal copy of the demo content. Feel free to
              modify or delete anything.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg text-muted-foreground">
              Your Demo workspace is ready. Continue exploring AI capabilities
              with sample conversations and documents.
            </p>
            <div className="text-left space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Your workspace is set up</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Sample content available</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Ready to explore AI features</span>
              </div>
            </div>
          </>
        )}

        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={`/workspace/${workspaceId}`}>
            {isNewWorkspace
              ? 'Explore Demo Workspace'
              : 'Continue to Workspace'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
