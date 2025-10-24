'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEditor, EditorContent } from '@tiptap/react';
import TiptapStarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Edit,
} from 'lucide-react';
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
  updateDomainAction,
  createDomainAction,
} from '@/app/admin/domains/actions';
import type { DomainWithRelations, ArtifactType } from '@/lib/db/schema';
import { ArtifactCategory } from '@/lib/db/schema';

const domainSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  defaultObjectiveArtifactTypeId: z.string().uuid(),
  defaultSummaryArtifactTypeId: z.string().uuid(),
  defaultObjectiveActionsArtifactTypeId: z.string().uuid(),
  defaultWorkspaceContextArtifactTypeId: z.string().uuid(),
  defaultObjectiveContextArtifactTypeId: z.string().uuid(),
});

type DomainFormData = z.infer<typeof domainSchema>;

interface DomainFormProps {
  domain?: DomainWithRelations;
  artifactTypes: ArtifactType[];
}

export function DomainForm({ domain, artifactTypes }: DomainFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter artifact types by category
  const objectiveTypes = artifactTypes.filter(
    (at) => at.category === ArtifactCategory.OBJECTIVE,
  );
  const summaryTypes = artifactTypes.filter(
    (at) => at.category === ArtifactCategory.SUMMARY,
  );
  const objectiveActionsTypes = artifactTypes.filter(
    (at) => at.category === ArtifactCategory.OBJECTIVE_ACTIONS,
  );
  const contextTypes = artifactTypes.filter(
    (at) =>
      at.category === ArtifactCategory.WORKSPACE_CONTEXT ||
      at.category === ArtifactCategory.OBJECTIVE_CONTEXT,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<DomainFormData>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      title: domain?.title || '',
      description: domain?.description || '',
      systemPrompt: domain?.systemPrompt || '',
      defaultObjectiveArtifactTypeId:
        domain?.defaultObjectiveArtifactTypeId || '',
      defaultSummaryArtifactTypeId: domain?.defaultSummaryArtifactTypeId || '',
      defaultObjectiveActionsArtifactTypeId:
        domain?.defaultObjectiveActionsArtifactTypeId || '',
      defaultWorkspaceContextArtifactTypeId:
        domain?.defaultWorkspaceContextArtifactTypeId || '',
      defaultObjectiveContextArtifactTypeId:
        domain?.defaultObjectiveContextArtifactTypeId || '',
    },
  });

  const defaultObjectiveArtifactTypeId = watch(
    'defaultObjectiveArtifactTypeId',
  );
  const defaultSummaryArtifactTypeId = watch('defaultSummaryArtifactTypeId');
  const defaultObjectiveActionsArtifactTypeId = watch(
    'defaultObjectiveActionsArtifactTypeId',
  );
  const defaultWorkspaceContextArtifactTypeId = watch(
    'defaultWorkspaceContextArtifactTypeId',
  );
  const defaultObjectiveContextArtifactTypeId = watch(
    'defaultObjectiveContextArtifactTypeId',
  );

  // Create Tiptap editor for system prompt
  const systemPromptEditor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: domain?.systemPrompt || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-4 min-h-[300px]',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      setValue('systemPrompt', markdown);
    },
  });

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      systemPromptEditor?.destroy();
    };
  }, [systemPromptEditor]);

  // Force re-renders when selection changes to update button active states
  const [, setEditorState] = useState(0);

  useEffect(() => {
    if (!systemPromptEditor) return;

    const handleUpdate = () => {
      setEditorState((prev) => prev + 1);
    };

    systemPromptEditor.on('selectionUpdate', handleUpdate);
    systemPromptEditor.on('update', handleUpdate);

    return () => {
      systemPromptEditor.off('selectionUpdate', handleUpdate);
      systemPromptEditor.off('update', handleUpdate);
    };
  }, [systemPromptEditor]);

  const onSubmit = async (data: DomainFormData) => {
    setIsSubmitting(true);
    try {
      if (domain) {
        // Edit mode - call updateDomainAction
        await updateDomainAction(domain.id, data);
        toast({
          title: 'Domain updated',
          description: `${data.title} has been updated successfully.`,
        });
      } else {
        // Create mode - call createDomainAction
        const result = await createDomainAction(data);
        if (result.success) {
          toast({
            title: 'Domain created',
            description: `${data.title} has been created successfully.`,
          });
        }
      }
      router.push('/admin/domains');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: domain
          ? 'Failed to update domain.'
          : 'Failed to create domain.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="e.g., Sales Intelligence"
        />
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
          placeholder="Describe when to use this domain"
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="systemPrompt">
          System Prompt <span className="text-destructive">*</span>
        </Label>
        <div className="border rounded-md">
          <div className="flex gap-1 p-2 border-b bg-muted/50">
            {/* Bold */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor?.chain().focus().toggleBold().run()
              }
              className={systemPromptEditor?.isActive('bold') ? 'bg-muted' : ''}
            >
              <Bold className="size-4" />
            </Button>

            {/* Italic */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor?.chain().focus().toggleItalic().run()
              }
              className={
                systemPromptEditor?.isActive('italic') ? 'bg-muted' : ''
              }
            >
              <Italic className="size-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Heading 1 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: 1 })
                  .run()
              }
              className={
                systemPromptEditor?.isActive('heading', { level: 1 })
                  ? 'bg-muted'
                  : ''
              }
            >
              <Heading1 className="size-4" />
            </Button>

            {/* Heading 2 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: 2 })
                  .run()
              }
              className={
                systemPromptEditor?.isActive('heading', { level: 2 })
                  ? 'bg-muted'
                  : ''
              }
            >
              <Heading2 className="size-4" />
            </Button>

            {/* Heading 3 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: 3 })
                  .run()
              }
              className={
                systemPromptEditor?.isActive('heading', { level: 3 })
                  ? 'bg-muted'
                  : ''
              }
            >
              <Heading3 className="size-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Bullet List */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor?.chain().focus().toggleBulletList().run()
              }
              className={
                systemPromptEditor?.isActive('bulletList') ? 'bg-muted' : ''
              }
            >
              <List className="size-4" />
            </Button>

            {/* Ordered List */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor?.chain().focus().toggleOrderedList().run()
              }
              className={
                systemPromptEditor?.isActive('orderedList') ? 'bg-muted' : ''
              }
            >
              <ListOrdered className="size-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Code Block */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                systemPromptEditor?.chain().focus().toggleCodeBlock().run()
              }
              className={
                systemPromptEditor?.isActive('codeBlock') ? 'bg-muted' : ''
              }
            >
              <Code className="size-4" />
            </Button>
          </div>
          <EditorContent editor={systemPromptEditor} />
        </div>
        {errors.systemPrompt && (
          <p className="text-sm text-destructive">
            {errors.systemPrompt.message}
          </p>
        )}
      </div>

      {/* Artifact Type Configuration */}
      <div className="space-y-4 pt-4 border-t">
        <div className="space-y-1 mb-4">
          <h3 className="text-lg font-semibold">Artifact Type Defaults</h3>
          <p className="text-sm text-muted-foreground">
            Configure which artifact types this domain uses for different
            scenarios. Each domain must have exactly one artifact type selected
            for each category.
          </p>
        </div>

        {/* 1. Objective Goal Type */}
        <div className="space-y-2">
          <Label htmlFor="defaultObjectiveArtifactTypeId">
            Objective Goal Type <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Used to generate the primary objective document when creating a new
            objective
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select
                value={defaultObjectiveArtifactTypeId}
                onValueChange={(value) =>
                  setValue('defaultObjectiveArtifactTypeId', value)
                }
              >
                <SelectTrigger id="defaultObjectiveArtifactTypeId">
                  <SelectValue placeholder="Select objective goal type">
                    {defaultObjectiveArtifactTypeId &&
                      objectiveTypes.find(
                        (at) => at.id === defaultObjectiveArtifactTypeId,
                      )?.title}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {objectiveTypes.map((artifactType) => (
                    <SelectItem
                      key={artifactType.id}
                      value={artifactType.id}
                      className="py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {artifactType.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {artifactType.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(
                  `/admin/artifact-types/${defaultObjectiveArtifactTypeId}/edit`,
                )
              }
              disabled={!defaultObjectiveArtifactTypeId}
            >
              <Edit className="size-4" />
            </Button>
          </div>
          {errors.defaultObjectiveArtifactTypeId && (
            <p className="text-sm text-destructive">
              {errors.defaultObjectiveArtifactTypeId.message}
            </p>
          )}
        </div>

        {/* 2. Objective Actions Type */}
        <div className="space-y-2">
          <Label htmlFor="defaultObjectiveActionsArtifactTypeId">
            Objective Actions Type <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Used to track action items and next steps related to objectives
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select
                value={defaultObjectiveActionsArtifactTypeId}
                onValueChange={(value) =>
                  setValue('defaultObjectiveActionsArtifactTypeId', value)
                }
              >
                <SelectTrigger id="defaultObjectiveActionsArtifactTypeId">
                  <SelectValue placeholder="Select objective actions type">
                    {defaultObjectiveActionsArtifactTypeId &&
                      objectiveActionsTypes.find(
                        (at) => at.id === defaultObjectiveActionsArtifactTypeId,
                      )?.title}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {objectiveActionsTypes.map((artifactType) => (
                    <SelectItem
                      key={artifactType.id}
                      value={artifactType.id}
                      className="py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {artifactType.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {artifactType.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(
                  `/admin/artifact-types/${defaultObjectiveActionsArtifactTypeId}/edit`,
                )
              }
              disabled={!defaultObjectiveActionsArtifactTypeId}
            >
              <Edit className="size-4" />
            </Button>
          </div>
          {errors.defaultObjectiveActionsArtifactTypeId && (
            <p className="text-sm text-destructive">
              {errors.defaultObjectiveActionsArtifactTypeId.message}
            </p>
          )}
        </div>

        {/* 3. Objective Artifact Type */}
        <div className="space-y-2">
          <Label htmlFor="defaultObjectiveContextArtifactTypeId">
            Objective Artifact Type <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Used to manage context specific to individual objectives
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select
                value={defaultObjectiveContextArtifactTypeId}
                onValueChange={(value) =>
                  setValue('defaultObjectiveContextArtifactTypeId', value)
                }
              >
                <SelectTrigger id="defaultObjectiveContextArtifactTypeId">
                  <SelectValue placeholder="Select objective artifact type">
                    {defaultObjectiveContextArtifactTypeId &&
                      contextTypes.find(
                        (at) => at.id === defaultObjectiveContextArtifactTypeId,
                      )?.title}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contextTypes.map((artifactType) => (
                    <SelectItem
                      key={artifactType.id}
                      value={artifactType.id}
                      className="py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {artifactType.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {artifactType.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(
                  `/admin/artifact-types/${defaultObjectiveContextArtifactTypeId}/edit`,
                )
              }
              disabled={!defaultObjectiveContextArtifactTypeId}
            >
              <Edit className="size-4" />
            </Button>
          </div>
          {errors.defaultObjectiveContextArtifactTypeId && (
            <p className="text-sm text-destructive">
              {errors.defaultObjectiveContextArtifactTypeId.message}
            </p>
          )}
        </div>

        {/* 4. Knowledge Summary Type */}
        <div className="space-y-2">
          <Label htmlFor="defaultSummaryArtifactTypeId">
            Knowledge Summary Type <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Used to process and summarize knowledge documents (transcripts,
            emails, notes)
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select
                value={defaultSummaryArtifactTypeId}
                onValueChange={(value) =>
                  setValue('defaultSummaryArtifactTypeId', value)
                }
              >
                <SelectTrigger id="defaultSummaryArtifactTypeId">
                  <SelectValue placeholder="Select knowledge summary type">
                    {defaultSummaryArtifactTypeId &&
                      summaryTypes.find(
                        (at) => at.id === defaultSummaryArtifactTypeId,
                      )?.title}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {summaryTypes.map((artifactType) => (
                    <SelectItem
                      key={artifactType.id}
                      value={artifactType.id}
                      className="py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {artifactType.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {artifactType.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(
                  `/admin/artifact-types/${defaultSummaryArtifactTypeId}/edit`,
                )
              }
              disabled={!defaultSummaryArtifactTypeId}
            >
              <Edit className="size-4" />
            </Button>
          </div>
          {errors.defaultSummaryArtifactTypeId && (
            <p className="text-sm text-destructive">
              {errors.defaultSummaryArtifactTypeId.message}
            </p>
          )}
        </div>

        {/* 5. Workspace Context Type */}
        <div className="space-y-2">
          <Label htmlFor="defaultWorkspaceContextArtifactTypeId">
            Workspace Context Type <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Used to manage workspace-level context and configuration
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select
                value={defaultWorkspaceContextArtifactTypeId}
                onValueChange={(value) =>
                  setValue('defaultWorkspaceContextArtifactTypeId', value)
                }
              >
                <SelectTrigger id="defaultWorkspaceContextArtifactTypeId">
                  <SelectValue placeholder="Select workspace context type">
                    {defaultWorkspaceContextArtifactTypeId &&
                      contextTypes.find(
                        (at) => at.id === defaultWorkspaceContextArtifactTypeId,
                      )?.title}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contextTypes.map((artifactType) => (
                    <SelectItem
                      key={artifactType.id}
                      value={artifactType.id}
                      className="py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {artifactType.title}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {artifactType.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(
                  `/admin/artifact-types/${defaultWorkspaceContextArtifactTypeId}/edit`,
                )
              }
              disabled={!defaultWorkspaceContextArtifactTypeId}
            >
              <Edit className="size-4" />
            </Button>
          </div>
          {errors.defaultWorkspaceContextArtifactTypeId && (
            <p className="text-sm text-destructive">
              {errors.defaultWorkspaceContextArtifactTypeId.message}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : domain
              ? 'Update Domain'
              : 'Create Domain'}
        </Button>
      </div>
    </form>
  );
}
