'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface AIAssistedTextInputProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  instruction: string;
  context?: Record<string, string | number | boolean | string[]>;
  generateAction: (
    instruction: string,
    context: Record<string, string | number | boolean | string[]>,
  ) => Promise<string>;
}

/**
 * AI-Assisted Text Input Component
 *
 * Drop-in replacement for Input or Textarea with AI generation capabilities.
 * Calls a server action to generate text based on instruction and context.
 *
 * @example
 * <AIAssistedTextInput
 *   value={description}
 *   onChange={setDescription}
 *   multiline
 *   rows={3}
 *   placeholder="Describe this objective..."
 *   instruction="Generate a description for an objective"
 *   context={{ title: "Implement authentication" }}
 *   generateAction={generateAIText}
 * />
 */
export function AIAssistedTextInput({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  disabled = false,
  className,
  instruction,
  context = {},
  generateAction,
}: AIAssistedTextInputProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generatedText = await generateAction(instruction, context);
      onChange(generatedText);
      toast.success('Text generated');
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate text. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex gap-2">
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled || isGenerating}
          className={className}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || isGenerating}
          className={className}
        />
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleGenerate}
        disabled={disabled || isGenerating}
        title="Generate with AI"
      >
        {isGenerating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </Button>
    </div>
  );
}
