'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  updateArtifactTypeAction,
  createArtifactTypeAction,
} from '@/app/admin/artifact-types/actions';
import type { ArtifactType } from '@/lib/db/schema';
import { ArtifactCategory } from '@/lib/db/schema';
import { getCategoryDisplayName } from '@/lib/artifacts/utils';
import { MarkdownEditor } from '@/components/markdown/markdown-editor';

const artifactTypeSchema = z.object({
  category: z.enum([
    'objective',
    'summary',
    'objectiveActions',
    'workspaceContext',
    'objectiveContext',
  ]),
  label: z.string().min(1, 'Label is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  instructionPrompt: z.string().min(1, 'Instruction prompt is required'),
  template: z.string().optional(),
});

type ArtifactTypeFormData = z.infer<typeof artifactTypeSchema>;

interface ArtifactTypeFormProps {
  artifactType?: ArtifactType;
  mode: 'create' | 'edit';
}

export function ArtifactTypeForm({
  artifactType,
  mode,
}: ArtifactTypeFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ArtifactTypeFormData>({
    resolver: zodResolver(artifactTypeSchema),
    defaultValues: {
      category: artifactType?.category || 'objective',
      label: artifactType?.label || '',
      title: artifactType?.title || '',
      description: artifactType?.description || '',
      instructionPrompt: artifactType?.instructionPrompt || '',
      template: artifactType?.template || '',
    },
  });

  const onSubmit = async (data: ArtifactTypeFormData) => {
    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        // Create mode - call createArtifactTypeAction
        const result = await createArtifactTypeAction(data);
        toast({
          title: 'Artifact type created',
          description: `${data.title} has been created successfully.`,
        });
        router.push(`/admin/artifact-types/${result.artifactTypeId}/edit`);
        router.refresh();
      } else if (artifactType) {
        // Edit mode - call updateArtifactTypeAction
        await updateArtifactTypeAction(artifactType.id, data);
        toast({
          title: 'Artifact type updated',
          description: `${data.title} has been updated successfully.`,
        });
        router.push('/admin/artifact-types');
        router.refresh();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          mode === 'create'
            ? 'Failed to create artifact type.'
            : 'Failed to update artifact type.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* Category Select - Only enabled in create mode */}
      <div className="space-y-2">
        <Label htmlFor="category">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={watch('category')}
          onValueChange={(value) =>
            setValue('category', value as ArtifactTypeFormData['category'])
          }
          disabled={mode === 'edit'}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ArtifactCategory.OBJECTIVE}>
              {getCategoryDisplayName(ArtifactCategory.OBJECTIVE)}
            </SelectItem>
            <SelectItem value={ArtifactCategory.SUMMARY}>
              {getCategoryDisplayName(ArtifactCategory.SUMMARY)}
            </SelectItem>
            <SelectItem value={ArtifactCategory.OBJECTIVE_ACTIONS}>
              {getCategoryDisplayName(ArtifactCategory.OBJECTIVE_ACTIONS)}
            </SelectItem>
            <SelectItem value={ArtifactCategory.WORKSPACE_CONTEXT}>
              {getCategoryDisplayName(ArtifactCategory.WORKSPACE_CONTEXT)}
            </SelectItem>
            <SelectItem value={ArtifactCategory.OBJECTIVE_CONTEXT}>
              {getCategoryDisplayName(ArtifactCategory.OBJECTIVE_CONTEXT)}
            </SelectItem>
          </SelectContent>
        </Select>
        {mode === 'edit' && (
          <p className="text-xs text-muted-foreground">
            Category cannot be changed after creation
          </p>
        )}
        {errors.category && (
          <p className="text-sm text-destructive">{errors.category.message}</p>
        )}
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">
          Label <span className="text-destructive">*</span>
        </Label>
        <Input
          id="label"
          {...register('label')}
          placeholder="e.g., sales-doc"
        />
        <p className="text-xs text-muted-foreground">
          Short identifier used in code and URLs
        </p>
        {errors.label && (
          <p className="text-sm text-destructive">{errors.label.message}</p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="e.g., Sales Call Summary"
        />
        <p className="text-xs text-muted-foreground">
          User-facing title shown in UI
        </p>
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          rows={3}
          placeholder="What is this artifact type used for?"
        />
        <p className="text-xs text-muted-foreground">
          Explain when and how this artifact type should be used
        </p>
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Instruction Prompt Editor */}
      <div className="space-y-2">
        <Label htmlFor="instructionPrompt">
          Instruction Prompt <span className="text-destructive">*</span>
        </Label>
        <MarkdownEditor
          value={watch('instructionPrompt')}
          onChange={(content) => setValue('instructionPrompt', content)}
          placeholder="Enter AI instructions for generating this artifact type..."
          maxLength={50000}
          autoSave={false}
          showCharacterCount={true}
          ariaLabel="Instruction prompt editor"
        />
        <p className="text-xs text-muted-foreground">
          AI system prompt with instructions for generating this artifact type
        </p>
        {errors.instructionPrompt && (
          <p className="text-sm text-destructive">
            {errors.instructionPrompt.message}
          </p>
        )}
      </div>

      {/* Template Editor */}
      <div className="space-y-2">
        <Label htmlFor="template">Template (Optional)</Label>
        <MarkdownEditor
          value={watch('template') || ''}
          onChange={(content) => setValue('template', content)}
          placeholder="Enter markdown template structure (optional)..."
          maxLength={50000}
          autoSave={false}
          showCharacterCount={true}
          ariaLabel="Template editor"
        />
        <p className="text-xs text-muted-foreground">
          Markdown template structure for generated content (optional for
          context types)
        </p>
        {errors.template && (
          <p className="text-sm text-destructive">{errors.template.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : mode === 'create'
              ? 'Create Artifact Type'
              : 'Update Artifact Type'}
        </Button>
      </div>
    </form>
  );
}
