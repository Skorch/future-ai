import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { DocumentTypeBadge } from './document-type-badge';

interface DocumentFilterBarProps {
  sortBy: 'created' | 'title';
  setSortBy: (value: 'created' | 'title') => void;
  filterType: string;
  setFilterType: (value: string) => void;
  types: string[];
}

export function DocumentFilterBar({
  sortBy,
  setSortBy,
  filterType,
  setFilterType,
  types,
}: DocumentFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created">Most Recent</SelectItem>
          <SelectItem value="title">Title (A-Z)</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Filter by type..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {types.map((type) => (
            <SelectItem key={type} value={type}>
              <div className="flex items-center gap-2">
                <DocumentTypeBadge type={type} />
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
