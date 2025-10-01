import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DocumentTypeBadgeProps {
  type: string;
  className?: string;
}

// Map document types to badge variants and display names
const documentTypeConfig: Record<
  string,
  {
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    label: string;
  }
> = {
  text: { variant: 'default', label: 'Text' },
  transcript: { variant: 'secondary', label: 'Transcript' },
  code: { variant: 'outline', label: 'Code' },
  image: { variant: 'outline', label: 'Image' },
  sheet: { variant: 'outline', label: 'Sheet' },
};

export function DocumentTypeBadge({ type, className }: DocumentTypeBadgeProps) {
  const config = documentTypeConfig[type] || {
    variant: 'default' as const,
    label: type,
  };

  return (
    <Badge variant={config.variant} className={cn('capitalize', className)}>
      {config.label}
    </Badge>
  );
}
