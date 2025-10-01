interface DocumentByteSizeProps {
  bytes: number;
  className?: string;
}

export function DocumentByteSize({ bytes, className }: DocumentByteSizeProps) {
  const formatted = formatByteSize(bytes);

  return <span className={className}>{formatted}</span>;
}

function formatByteSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
