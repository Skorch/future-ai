'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import { ObjectiveCard } from './objective-card';
import { CreateObjectiveDialog } from './create-objective-dialog';
import type { Objective } from '@/lib/db/objective';

interface ObjectiveListProps {
  workspaceId: string;
  objectives: Objective[];
}

export function ObjectiveList({ workspaceId, objectives }: ObjectiveListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const router = useRouter();

  const handleObjectiveCreated = (objectiveId: string) => {
    router.push(`/workspace/${workspaceId}/objective/${objectiveId}`);
  };

  if (objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-semibold mb-2">No objectives yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first objective to get started
        </p>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusIcon className="mr-2 size-4" />
          New Objective
        </Button>

        <CreateObjectiveDialog
          workspaceId={workspaceId}
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={handleObjectiveCreated}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header with Create Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Objectives</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <PlusIcon className="mr-2 size-4" />
          New Objective
        </Button>
      </div>

      {/* Objectives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {objectives.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            workspaceId={workspaceId}
          />
        ))}
      </div>

      <CreateObjectiveDialog
        workspaceId={workspaceId}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleObjectiveCreated}
      />
    </div>
  );
}
