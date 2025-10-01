import { Input } from './ui/input';
import { Search } from 'lucide-react';

interface DocumentSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function DocumentSearchBar({ value, onChange }: DocumentSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        placeholder="Search documents by title..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 max-w-md"
      />
    </div>
  );
}
