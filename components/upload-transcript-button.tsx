'use client';

import { Button } from '@/components/ui/button';
import { FileAudioIcon, LoaderIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

interface UploadTranscriptButtonProps {
  workspaceId: string;
  objectiveId: string;
  onFileSelected: (content: string) => void; // Callback to open modal with content
}

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt', '.transcript'];
const MAX_FILE_SIZE = 400 * 1024; // 400KB to ensure ~100k tokens (well under 200k limit)

export function UploadTranscriptButton({
  workspaceId,
  objectiveId,
  onFileSelected,
}: UploadTranscriptButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    event.target.value = '';

    // Validate file extension
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      toast.error(
        `Invalid file type. Please upload: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = (MAX_FILE_SIZE / 1024).toFixed(0);
      toast.error(
        `File too large. Maximum size is ${maxSizeMB}KB for optimal processing.`,
      );
      return;
    }

    // Read file and open modal with content
    setIsReading(true);
    try {
      const content = await file.text();
      onFileSelected(content);
    } catch (error) {
      toast.error('Failed to read file content');
    } finally {
      setIsReading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        onChange={handleFileChange}
        accept={ALLOWED_EXTENSIONS.join(',')}
        disabled={isReading}
        tabIndex={-1}
      />
      <Button
        onClick={handleButtonClick}
        disabled={isReading}
        variant="outline"
        className="flex items-center gap-2 rounded-full hover:bg-muted/50 transition-all"
        size="default"
      >
        {isReading ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <FileAudioIcon className="size-4" />
        )}
        <span className="font-medium">
          {isReading ? 'Reading...' : 'Upload Transcript'}
        </span>
      </Button>
    </>
  );
}
