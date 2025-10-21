'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
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
  FileCode,
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
  updateArtifactTypeAction,
  createArtifactTypeAction,
} from '@/app/admin/artifact-types/actions';
import type { ArtifactType } from '@/lib/db/schema';

const artifactTypeSchema = z.object({
  category: z.enum(['objective', 'summary', 'objectiveActions', 'context']),
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

  // Create Tiptap editor for instruction prompt
  const instructionPromptEditor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: artifactType?.instructionPrompt || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-4 min-h-[200px]',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      setValue('instructionPrompt', markdown);
    },
  });

  // Create Tiptap editor for template
  const templateEditor = useEditor({
    extensions: [
      TiptapStarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: artifactType?.template || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none p-4 min-h-[200px]',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown =
        // biome-ignore lint/suspicious/noExplicitAny: Tiptap storage types don't include markdown extension
        (editor.storage as any).markdown?.getMarkdown?.() || editor.getText();
      setValue('template', markdown);
    },
  });

  // Cleanup editors on unmount
  useEffect(() => {
    return () => {
      instructionPromptEditor?.destroy();
      templateEditor?.destroy();
    };
  }, [instructionPromptEditor, templateEditor]);

  // Force re-renders when selection changes to update button active states
  const [, setEditorState] = useState(0);

  useEffect(() => {
    if (!instructionPromptEditor && !templateEditor) return;

    const handleUpdate = () => {
      setEditorState((prev) => prev + 1);
    };

    instructionPromptEditor?.on('selectionUpdate', handleUpdate);
    instructionPromptEditor?.on('update', handleUpdate);
    templateEditor?.on('selectionUpdate', handleUpdate);
    templateEditor?.on('update', handleUpdate);

    return () => {
      instructionPromptEditor?.off('selectionUpdate', handleUpdate);
      instructionPromptEditor?.off('update', handleUpdate);
      templateEditor?.off('selectionUpdate', handleUpdate);
      templateEditor?.off('update', handleUpdate);
    };
  }, [instructionPromptEditor, templateEditor]);

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

  const renderToolbar = (editor: Editor | null, editorName: string) => {
    if (!editor) return null;
    return (
      <div className="flex gap-1 p-2 border-b bg-muted/50">
        {/* Bold */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'bg-muted' : ''}
          aria-label={`Toggle bold in ${editorName}`}
        >
          <Bold className="size-4" />
        </Button>

        {/* Italic */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={editor?.isActive('italic') ? 'bg-muted' : ''}
          aria-label={`Toggle italic in ${editorName}`}
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
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor?.isActive('heading', { level: 1 }) ? 'bg-muted' : ''
          }
          aria-label={`Toggle heading 1 in ${editorName}`}
        >
          <Heading1 className="size-4" />
        </Button>

        {/* Heading 2 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor?.isActive('heading', { level: 2 }) ? 'bg-muted' : ''
          }
          aria-label={`Toggle heading 2 in ${editorName}`}
        >
          <Heading2 className="size-4" />
        </Button>

        {/* Heading 3 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor?.isActive('heading', { level: 3 }) ? 'bg-muted' : ''
          }
          aria-label={`Toggle heading 3 in ${editorName}`}
        >
          <Heading3 className="size-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Bullet List */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={editor?.isActive('bulletList') ? 'bg-muted' : ''}
          aria-label={`Toggle bullet list in ${editorName}`}
        >
          <List className="size-4" />
        </Button>

        {/* Ordered List */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={editor?.isActive('orderedList') ? 'bg-muted' : ''}
          aria-label={`Toggle ordered list in ${editorName}`}
        >
          <ListOrdered className="size-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Code */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleCode().run()}
          className={editor?.isActive('code') ? 'bg-muted' : ''}
          aria-label={`Toggle inline code in ${editorName}`}
        >
          <Code className="size-4" />
        </Button>

        {/* Code Block */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          className={editor?.isActive('codeBlock') ? 'bg-muted' : ''}
          aria-label={`Toggle code block in ${editorName}`}
        >
          <FileCode className="size-4" />
        </Button>
      </div>
    );
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
            <SelectItem value="objective">Objective</SelectItem>
            <SelectItem value="summary">Summary</SelectItem>
            <SelectItem value="objectiveActions">Objective Actions</SelectItem>
            <SelectItem value="context">Context</SelectItem>
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
        <div className="border rounded-md">
          {renderToolbar(instructionPromptEditor, 'instruction prompt')}
          <EditorContent editor={instructionPromptEditor} />
        </div>
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
        <div className="border rounded-md">
          {renderToolbar(templateEditor, 'template')}
          <EditorContent editor={templateEditor} />
        </div>
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
