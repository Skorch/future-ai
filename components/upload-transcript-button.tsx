'use client';

import { Button } from '@/components/ui/button';
import { FileAudioIcon, LoaderIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface UploadTranscriptButtonProps {
  workspaceId: string;
  objectiveId: string;
  onUploadComplete?: (documentId: string) => void;
}

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.vtt', '.srt', '.transcript'];
const MAX_FILE_SIZE = 400 * 1024; // 400KB to ensure ~100k tokens (well under 200k limit)

export function UploadTranscriptButton({
  workspaceId,
  objectiveId,
  onUploadComplete,
}: UploadTranscriptButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be uploaded again
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

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('objectiveId', objectiveId);
      formData.append('workspaceId', workspaceId);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      toast.success('Transcript uploaded and analyzed successfully!');

      // Refresh the page to show new document
      router.refresh();

      // Notify parent component
      onUploadComplete?.(data.documentId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload transcript',
      );
    } finally {
      setIsUploading(false);
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
        disabled={isUploading}
        tabIndex={-1}
      />
      <Button
        onClick={handleButtonClick}
        disabled={isUploading}
        className="flex items-center gap-2 rounded-lg shadow-sm hover:shadow-md transition-all"
        size="default"
      >
        {isUploading ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <FileAudioIcon className="size-4" />
        )}
        <span className="font-medium">
          {isUploading ? 'Uploading...' : 'Upload Transcript'}
        </span>
      </Button>
    </>
  );
}
