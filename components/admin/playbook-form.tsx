'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Reorder } from 'framer-motion';
import { GripVertical, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { createPlaybook, updatePlaybook } from '@/app/admin/playbooks/actions';
import type { PlaybookWithSteps } from '@/lib/db/schema';

const playbookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  whenToUse: z.string().optional(),
  domains: z.array(z.string()).min(1, 'At least one domain is required'),
  steps: z
    .array(
      z.object({
        id: z.string(),
        instruction: z.string().min(1, 'Step instruction cannot be empty'),
      }),
    )
    .min(1, 'At least one step is required'),
});

type PlaybookFormData = z.infer<typeof playbookSchema>;

interface PlaybookFormProps {
  playbook?: PlaybookWithSteps;
}

const AVAILABLE_DOMAINS = ['sales', 'meeting'];

const FIELD_INFO = {
  name: 'Unique identifier for this playbook. Used by agents to reference this workflow.',
  description:
    'Brief summary shown in playbook listings and tool descriptions.',
  whenToUse:
    'Triggering conditions that tell the agent when to retrieve and execute this playbook.',
  domains:
    'Which workspace domains can access this playbook. Agents only see playbooks matching their domain.',
  steps:
    'Sequential instructions the agent follows. Supports markdown formatting. Drag to reorder.',
};

export function PlaybookForm({ playbook }: PlaybookFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PlaybookFormData>({
    resolver: zodResolver(playbookSchema),
    defaultValues: {
      name: playbook?.name || '',
      description: playbook?.description || '',
      whenToUse: playbook?.whenToUse || '',
      domains: playbook?.domains || ['sales'],
      steps: playbook?.steps.map((step, index) => ({
        id: step.id,
        instruction: step.instruction,
      })) || [{ id: crypto.randomUUID(), instruction: '' }],
    },
  });

  const domains = watch('domains');
  const steps = watch('steps');

  const toggleDomain = (domain: string) => {
    const current = domains || [];
    if (current.includes(domain)) {
      setValue(
        'domains',
        current.filter((d) => d !== domain),
      );
    } else {
      setValue('domains', [...current, domain]);
    }
  };

  const addStep = () => {
    setValue('steps', [...steps, { id: crypto.randomUUID(), instruction: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setValue(
        'steps',
        steps.filter((_, i) => i !== index),
      );
    }
  };

  const updateStepInstruction = (index: number, instruction: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], instruction };
    setValue('steps', updated);
  };

  const reorderSteps = (newOrder: typeof steps) => {
    setValue('steps', newOrder);
  };

  const onSubmit = async (data: PlaybookFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        whenToUse: data.whenToUse || undefined,
        domains: data.domains,
        steps: data.steps.map((step, index) => ({
          sequence: index + 1,
          instruction: step.instruction,
        })),
      };

      if (playbook) {
        await updatePlaybook(playbook.id, payload);
        toast({
          title: 'Playbook updated',
          description: `${data.name} has been updated successfully.`,
        });
      } else {
        await createPlaybook(payload);
        toast({
          title: 'Playbook created',
          description: `${data.name} has been created successfully.`,
        });
      }

      router.push('/admin/playbooks');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${playbook ? 'update' : 'create'} playbook.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
        {/* Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <InfoTooltip content={FIELD_INFO.name} />
          </div>
          <Input
            id="name"
            {...register('name')}
            placeholder="e.g., bant-validation"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="description">Description</Label>
            <InfoTooltip content={FIELD_INFO.description} />
          </div>
          <Textarea
            id="description"
            {...register('description')}
            rows={3}
            placeholder="Brief summary of what this playbook does"
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* When to Use */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="whenToUse">When to Use</Label>
            <InfoTooltip content={FIELD_INFO.whenToUse} />
          </div>
          <Textarea
            id="whenToUse"
            {...register('whenToUse')}
            rows={3}
            placeholder="Describe when the agent should use this playbook"
          />
          {errors.whenToUse && (
            <p className="text-sm text-destructive">
              {errors.whenToUse.message}
            </p>
          )}
        </div>

        {/* Domains */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>
              Domains <span className="text-destructive">*</span>
            </Label>
            <InfoTooltip content={FIELD_INFO.domains} />
          </div>
          <div className="flex gap-4">
            {AVAILABLE_DOMAINS.map((domain) => (
              <div key={domain} className="flex items-center space-x-2">
                <Checkbox
                  id={`domain-${domain}`}
                  checked={domains.includes(domain)}
                  onCheckedChange={() => toggleDomain(domain)}
                />
                <label
                  htmlFor={`domain-${domain}`}
                  className="text-sm capitalize cursor-pointer"
                >
                  {domain}
                </label>
              </div>
            ))}
          </div>
          {errors.domains && (
            <p className="text-sm text-destructive">{errors.domains.message}</p>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>
              Steps <span className="text-destructive">*</span>
            </Label>
            <InfoTooltip content={FIELD_INFO.steps} />
          </div>

          <Reorder.Group
            axis="y"
            values={steps}
            onReorder={reorderSteps}
            className="space-y-3"
          >
            {steps.map((step, index) => (
              <Reorder.Item
                key={step.id}
                value={step}
                className="border rounded-lg p-4 bg-card"
              >
                <div className="flex gap-3">
                  <div className="flex items-start gap-2 pt-2">
                    <GripVertical className="size-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {index + 1}.
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={step.instruction}
                      onChange={(e) =>
                        updateStepInstruction(index, e.target.value)
                      }
                      rows={4}
                      placeholder="Enter step instruction (markdown supported)"
                      className="resize-none"
                    />
                    {errors.steps?.[index]?.instruction && (
                      <p className="text-sm text-destructive">
                        {errors.steps[index]?.instruction?.message}
                      </p>
                    )}
                  </div>
                  {steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                      className="mt-1"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove step</span>
                    </Button>
                  )}
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addStep}
            className="mt-2"
          >
            + Add Step
          </Button>

          {errors.steps && !Array.isArray(errors.steps) && (
            <p className="text-sm text-destructive">{errors.steps.message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : playbook
                ? 'Update Playbook'
                : 'Create Playbook'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/playbooks')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </TooltipProvider>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="size-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}
